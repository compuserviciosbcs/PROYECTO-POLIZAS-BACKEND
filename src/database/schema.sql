-- ============================================================
--  POLIZAS CRM — Schema MySQL
--  Importar o ejecutar: npm run db:init
-- ============================================================

CREATE DATABASE IF NOT EXISTS polizas_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE polizas_crm;

-- TIPOS DE SERVICIO
CREATE TABLE IF NOT EXISTS tipos_servicio (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

INSERT IGNORE INTO tipos_servicio (nombre) VALUES
  ('Remoto'),('Presencial'),('Mantenimiento'),
  ('CONTPAQi'),('Capacitacion'),('Reportes'),('Administrativo');

-- CATALOGO DE SERVICIOS
CREATE TABLE IF NOT EXISTS servicios (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(150) NOT NULL,
  tipo_servicio_id INT NOT NULL,
  costo            DECIMAL(10,2) NOT NULL DEFAULT 0,
  activo           TINYINT(1) NOT NULL DEFAULT 1,
  creado_en        DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tipo_servicio_id) REFERENCES tipos_servicio(id)
);

-- GRUPOS DE POLIZAS
CREATE TABLE IF NOT EXISTS grupos_poliza (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE
);

INSERT IGNORE INTO grupos_poliza (nombre) VALUES
  ('Polizas de soporte general TI'),
  ('Polizas de soporte CONTPAQi'),
  ('Polizas Combo');

-- CATALOGO DE POLIZAS
CREATE TABLE IF NOT EXISTS polizas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  tipo           VARCHAR(100) NOT NULL,
  grupo_id       INT NOT NULL,
  precio         DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento      DECIMAL(5,2)  NOT NULL DEFAULT 0,
  duracion       VARCHAR(50)   NOT NULL DEFAULT '12 meses',
  cobertura      TEXT,
  sla_respuesta  VARCHAR(80),
  sla_solucion   VARCHAR(80),
  activa         TINYINT(1) NOT NULL DEFAULT 1,
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos_poliza(id)
);

-- RELACION POLIZA - SERVICIOS
CREATE TABLE IF NOT EXISTS poliza_servicios (
  poliza_id   INT NOT NULL,
  servicio_id INT NOT NULL,
  PRIMARY KEY (poliza_id, servicio_id),
  FOREIGN KEY (poliza_id)   REFERENCES polizas(id)   ON DELETE CASCADE,
  FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE CASCADE
);

-- EMPRESAS
CREATE TABLE IF NOT EXISTS empresas (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nombre             VARCHAR(200) NOT NULL,
  rfc                VARCHAR(20)  NOT NULL UNIQUE,
  giro               VARCHAR(80),
  telefono           VARCHAR(30),
  email              VARCHAR(120),
  sitio              VARCHAR(120),
  direccion          TEXT,
  contacto_principal VARCHAR(150),
  estatus            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_en          DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- USUARIOS DE EMPRESA
CREATE TABLE IF NOT EXISTS usuarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre     VARCHAR(150) NOT NULL,
  cargo      VARCHAR(100),
  email      VARCHAR(120),
  telefono   VARCHAR(30),
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- POLIZAS VINCULADAS A EMPRESA
CREATE TABLE IF NOT EXISTS empresa_polizas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id  INT NOT NULL,
  poliza_id   INT NOT NULL,
  vigencia    DATE,
  vencimiento DATE,
  activa      TINYINT(1) NOT NULL DEFAULT 1,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (poliza_id)  REFERENCES polizas(id)
);

-- TECNICOS
CREATE TABLE IF NOT EXISTS tecnicos (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(150) NOT NULL,
  email     VARCHAR(120),
  telefono  VARCHAR(30),
  activo    TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO tecnicos (nombre) VALUES
  ('Aleksey Unzon'),('Jose Mercado'),('Brandon Von');

-- INCIDENCIAS
CREATE TABLE IF NOT EXISTS incidencias (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  ticket            VARCHAR(20)  NOT NULL UNIQUE,
  empresa_id        INT NOT NULL,
  usuario_id        INT,
  empresa_poliza_id INT,
  tecnico_id        INT,
  asunto            VARCHAR(250) NOT NULL,
  descripcion       TEXT NOT NULL,
  clasificacion     ENUM('remota','presencial') NOT NULL DEFAULT 'remota',
  anydesk_id        VARCHAR(30),
  rioridad         ENUM('alta','media','baja')  NOT NULL DEFAULT 'media',
  estatus           ENUM('abierto','pendiente','solucionado','no_solucionado') NOT NULL DEFAULT 'abierto',
  solucion_aplicada TEXT,
  sla_respuesta_hrs DECIMAL(6,2),
  sla_solucion_hrs  DECIMAL(6,2),
  fecha_creacion    DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_ultima_act  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  fecha_cierre      DATETIME,
  FOREIGN KEY (empresa_id)        REFERENCES empresas(id),
  FOREIGN KEY (usuario_id)        REFERENCES usuarios(id)        ON DELETE SET NULL,
  FOREIGN KEY (empresa_poliza_id) REFERENCES empresa_polizas(id) ON DELETE SET NULL,
  FOREIGN KEY (tecnico_id)        REFERENCES tecnicos(id)        ON DELETE SET NULL
);

-- CITAS PRESENCIALES
CREATE TABLE IF NOT EXISTS citas_presenciales (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  incidencia_id INT NOT NULL UNIQUE,
  fecha_cita    DATE NOT NULL,
  hora_cita     TIME NOT NULL,
  direccion     TEXT,
  contacto      VARCHAR(150),
  telefono      VARCHAR(30),
  reagendada    TINYINT(1) NOT NULL DEFAULT 0,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incidencia_id) REFERENCES incidencias(id) ON DELETE CASCADE
);

-- NOTAS DE SEGUIMIENTO
CREATE TABLE IF NOT EXISTS notas_incidencia (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  incidencia_id INT NOT NULL,
  autor         VARCHAR(150) NOT NULL DEFAULT 'Admin',
  texto         TEXT NOT NULL,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incidencia_id) REFERENCES incidencias(id) ON DELETE CASCADE
);

-- BITACORA DE EMPRESA
CREATE TABLE IF NOT EXISTS bitacora_empresa (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id  INT NOT NULL,
  tipo        ENUM('Alta','Baja','Modificacion','Renovacion') NOT NULL,
  descripcion TEXT NOT NULL,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- MANTENIMIENTOS / CALENDARIO
CREATE TABLE IF NOT EXISTS mantenimientos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id   INT,
  tecnico_id   INT,
  incidencia_id INT,                                              -- liga el evento a un ticket, si aplica
  tipo         ENUM('mantenimiento','incidencia') NOT NULL DEFAULT 'mantenimiento',
  titulo       VARCHAR(200) NOT NULL,
  descripcion  TEXT,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin    DATETIME NOT NULL,
  reagendado   TINYINT(1) NOT NULL DEFAULT 0,
  creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id)    REFERENCES empresas(id)    ON DELETE SET NULL,
  FOREIGN KEY (tecnico_id)    REFERENCES tecnicos(id)    ON DELETE SET NULL,
  FOREIGN KEY (incidencia_id) REFERENCES incidencias(id) ON DELETE CASCADE
);
