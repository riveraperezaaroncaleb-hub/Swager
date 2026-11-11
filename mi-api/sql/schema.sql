CREATE DATABASE IF NOT EXISTS mi_api
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mi_api;

CREATE TABLE IF NOT EXISTS Usuarios (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  edad INT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_usuarios_edad CHECK (edad IS NULL OR edad >= 0)
);
