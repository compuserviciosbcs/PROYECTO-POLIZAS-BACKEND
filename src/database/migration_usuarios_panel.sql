-- Ejecutar en phpMyAdmin o con: mysql -u root polizas_crm 
USE polizas_crm;

CREATE TABLE IF NOT EXISTS usuarios_panel (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  email     VARCHAR(120) NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,
  activo    TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en DATETIME     DEFAULT CURRENT_TIMESTAMP
);
