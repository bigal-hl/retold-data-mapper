# Docker Images with Preloaded MySQL and PostgreSQL Data

This document lists single Docker images that come with databases already populated at container startup.

Focus:
- Fully preloaded
- Relational interconnected datasets
- Tiny and huge options

---

# MySQL Images

## Tiny datasets

### mysql-sakila images

Images:
- francescou/mysql-sakila
- kristofferv98/mysql-sakila

Dataset:
- Sakila
- Small but relational

Run:
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root francescou/mysql-sakila

---

### datacharmer/mysql-sample-db

Dataset:
- Sakila
- World database

Run:
docker run -d -p 3306:3306 datacharmer/mysql-sample-db

---

## Huge datasets

### andrespedes/mysql-large-sample-db

Dataset:
- Employees
- Sakila

Run:
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root andrespedes/mysql-large-sample-db

---

### Employees dataset images

Search term:
mysql employees sample database docker

Run:
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root <image-name>

---

# PostgreSQL Images

## Tiny datasets

### imiric/postgres-sakila

Dataset:
- Sakila port

Run:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres imiric/postgres-sakila

---

### dvdrental images

Example:
- tigergraph/postgres-dvdrental

Dataset:
- DVD rental relational schema

Run:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres tigergraph/postgres-dvdrental

---

## Huge datasets

### pagila images

Search term:
postgres pagila docker

Run:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres <image-name>

---

### large postgres datasets

Search term:
postgres large dataset docker preloaded

Run:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres <image-name>

---

# Dataset comparison

Sakila:
- small
- medium complexity

dvdrental:
- small
- medium complexity

Employees:
- large
- high complexity

Pagila:
- medium to large
- high complexity

---

# Notes

- These images may not be actively maintained
- Default credentials are often:
  - MySQL root root
  - Postgres postgres postgres
- Data is static

---

# Recommendation

Tiny:
- Sakila
- dvdrental

Huge:
- andrespedes/mysql-large-sample-db
- employees dataset images

---

# Pro tip

You can also mount SQL files at startup:

docker run -d -v ./data.sql:/docker-entrypoint-initdb.d/data.sql mysql

