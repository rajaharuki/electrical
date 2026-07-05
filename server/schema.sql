-- server/schema.sql
-- SQL schema for MySQL (create database and table)

CREATE DATABASE IF NOT EXISTS elektrons CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE elektrons;

CREATE TABLE IF NOT EXISTS memories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  url TEXT NOT NULL,
  path VARCHAR(255) NOT NULL,
  caption VARCHAR(255) DEFAULT NULL,
  date DATE DEFAULT NULL,
  fallback TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
