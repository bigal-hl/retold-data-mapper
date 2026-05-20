# Retold Data Mapper — long-running service.
# Port 8395 by default; serves the cross-beacon mapping web UI + REST
# API at /mapper/*. Connects to an Ultravisor as a beacon when
# DATAMAPPER_ULTRAVISOR_URL is set (or via --ultravisor flag).
#
# `npm install` (not `npm ci`) is intentional — package-lock.json is
# gitignored per the Quackage convention. See BUILDING-AND-PUBLISHING.md.

# Stage 1: Build the bundled web application.
# build-essential + python3 are needed here so npm rebuild can compile
# native bindings (better-sqlite3, etc.). They never make it into the
# runtime image — see Stage 2.
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get -y install build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
# `--ignore-scripts` because retold-data-mapper depends on `ultravisor`
# (devDep — used only by test harnesses), whose postinstall
# (`cd webinterface && npm install && npm run build`) needs `quack`
# (devDep) and routinely fails inside transitive installs.
# `npm rebuild` afterwards compiles native bindings the ignore-scripts
# would have skipped.
# `--no-optional` skips meadow-connection-rocksdb (peer-optional via
# meadow-connection-manager, ~93 MB native build) — the data-mapper
# doesn't speak RocksDB.
RUN npm install --ignore-scripts --no-optional && npm rebuild
COPY .quackage.json ./
COPY source/ source/
COPY bin/ bin/
COPY model/ model/
RUN npx quack build
# Strip devDependencies (incl. ultravisor at ~1.2 GB) so Stage 2 copies
# a lean tree. Native bindings already compiled by `npm rebuild` above
# and stay put.
RUN npm prune --omit=dev --ignore-scripts

# Stage 2: Runtime — node + the lean prebuilt node_modules from Stage 1.
# No compilers, no fresh npm install, no apt-get. The ~400 MB
# build-essential layer that used to live here is gone.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/source/ source/
COPY --from=builder /app/bin/    bin/
COPY --from=builder /app/model/  model/

RUN mkdir -p /app/data
EXPOSE 8395
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD node -e "const h=require('http');h.get('http://localhost:8395/',(r)=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "bin/retold-data-mapper.js", "serve"]
