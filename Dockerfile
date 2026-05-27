# Retold Data Mapper — long-running service.
# Port 8395 by default; serves the cross-beacon mapping web UI + REST
# API at /mapper/*. Connects to an Ultravisor as a beacon when
# RETOLD_DATA_MAPPER_ULTRAVISOR_URL is set (or via --ultravisor flag).
# Matching env vars: RETOLD_DATA_MAPPER_BEACON_NAME,
# RETOLD_DATA_MAPPER_BEACON_PASSWORD (+ _FILE for docker secrets),
# RETOLD_DATA_MAPPER_MAX_CONCURRENT. See bin/retold-data-mapper.js --help.
#
# `npm install` (not `npm ci`) is intentional — package-lock.json is
# gitignored per the Quackage convention. See BUILDING-AND-PUBLISHING.md.

# Stage 1: Build the bundled web application.
#
# Pure JS — no apt-get / build-essential / python3. The previous version
# of this Dockerfile installed build-essential to compile rocksdb (a
# transitive native dep via retold-databeacon → meadow-connection-rocksdb).
# rocksdb is ALREADY in retold-databeacon's optionalDependencies; the
# trap was `npm prune --omit=dev`: prune RE-RESOLVES the dep tree and,
# without --omit=optional, re-adds optional deps the original install
# skipped. Passing --omit=optional to BOTH install AND prune keeps
# rocksdb (and dtrace-provider, mongo, solr) out of the tree end-to-end.
# meadow-connection-manager loads providers lazily via require.resolve()
# inside try/catch (Meadow-ConnectionManager.js:75), so missing providers
# degrade gracefully at runtime.
#
# Result: the runtime tree contains ZERO native bindings, so the
# subsequent `npm rebuild` is a no-op safety net and Stage 1 doesn't
# need a C/Python toolchain. If a future runtime dep grows native code,
# re-add build-essential + python3 here.
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json ./
# `--ignore-scripts` because retold-data-mapper depends on `ultravisor`
# (devDep — used only by test harnesses), whose postinstall
# (`cd webinterface && npm install && npm run build`) needs `quack`
# (devDep) and routinely fails inside transitive installs.
# `--omit=optional` skips:
#   - meadow-connection-rocksdb / mongo / solr (optionalDeps in
#     retold-databeacon — none used by the data-mapper runtime)
#   - dtrace-provider (restify optionalDep, native build, unused on Linux)
RUN npm install --ignore-scripts --omit=optional
COPY .quackage.json ./
COPY source/ source/
COPY bin/ bin/
COPY model/ model/
# `quack build` is pure JS — uses gulp/browserify/etc from the dev tree
# but doesn't touch any native bindings.
RUN npx quack build
# Strip devDependencies (incl. ultravisor at ~1.2 GB + its transitive
# better-sqlite3). `--omit=optional` here is critical — without it,
# prune re-resolves and re-adds the optional deps the install skipped.
RUN npm prune --omit=dev --omit=optional --ignore-scripts
# Safety net: rebuild any native bindings in the runtime tree. With
# the optional-dep skips above, this is currently a no-op.
RUN npm rebuild

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
