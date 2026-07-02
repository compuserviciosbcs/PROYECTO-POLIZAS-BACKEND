-- ============================================================
--  MIGRACIÓN: agrega soporte de "tipo" e "incidencia_id"
--  a la tabla mantenimientos (para distinguir eventos de
--  mantenimiento preventivo vs. citas generadas por incidencias)
--
--  Ejecuta esto SOLO SI ya corriste schema.sql antes y la tabla
--  mantenimientos ya existe sin estas columnas.
--  Si vas a inicializar la BD desde cero, no necesitas este archivo.
-- ============================================================

USE crm_polizas-db;

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS incidencia_id INT NULL AFTER tecnico_id,
  ADD COLUMN IF NOT EXISTS tipo ENUM('mantenimiento','incidencia') NOT NULL DEFAULT 'mantenimiento' AFTER incidencia_id;

ALTER TABLE mantenimientos
  ADD CONSTRAINT fk_mantenimiento_incidencia
  FOREIGN KEY (incidencia_id) REFERENCES incidencias(id) ON DELETE CASCADE;
