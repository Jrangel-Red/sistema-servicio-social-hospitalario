# Sistema Integral de Servicio Social Hospitalario (PWA & Web)

Plataforma integral orientada a la gestión asistencial, triaje social y control estadístico hospitalario, desarrollada con enfoque de **Ciberseguridad**, arquitectura **Progressive Web App (PWA)** y soporte para dispositivos móviles y estaciones de escritorio.

---

## 📌 Características Principales

### 🛡️ Ciberseguridad y Control de Acceso
- **Autenticación en Dos Pasos (2FA TOTP):** Compatible con aplicaciones como Google Authenticator y Microsoft Authenticator.
- **Acceso Digital por Código QR:** Validación criptográfica mediante tokens firmados para credenciales físicas y móviles.
- **Control Jerárquico por Roles (RBAC):** Perfiles definidos para Administrador de Ciberseguridad, Trabajo Social y Dirección / Auditoría.

### 📊 Tableros de Control e Indicadores
- Visualización interactiva con **Chart.js** para toma de decisiones asistenciales.
- Métricas en tiempo real por especialidad médica, condición del paciente (Nuevo, Reingresante, Continuador) y tipo de cobertura de salud.
- Seguimiento de problemáticas de vulnerabilidad social y casos asistenciales prioritarios.

### 📋 Módulos Operativos
- **Maestro de Pacientes:** Registro centralizado y búsqueda rápida con clasificación demográfica.
- **Ficha Diaria de Trabajo Social:** Digitalización de informes diarios, registro de intervenciones y exoneraciones.
- **Alertas Automatizadas:** Detección de casos de vulnerabilidad alta (pacientes sin identificación, indigencia) con notificación por correo electrónico.
- **Exportación de Documentos:** Generación de matrices en hojas de cálculo y reportes listos para impresión.

---

## 🚀 Puesta en Marcha

### Prerrequisitos
- Node.js (versión 18 o superior)
- npm o gestor de paquetes equivalente

### Instalación y Ejecución

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/Jrangel-Red/sistema-servicio-social-hospitalario.git
   cd sistema-servicio-social-hospitalario
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. (Opcional) Regenerar base de datos demostrativa:
   ```bash
   npm run seed
   ```

4. Iniciar el servidor local:
   ```bash
   npm start
   ```

5. Abrir en el navegador en `http://localhost:3000`.

---

## 🔑 Cuentas Demostrativas de Prueba

| Usuario | Rol | Contraseña Demo | Código Maestro 2FA |
| :--- | :--- | :--- | :--- |
| `admin` | Administrador Ciberseguridad | `AdminHEJCU2026!` | `123456` |
| `ts_taravay` | Trabajo Social | `Social2026*` | `123456` |
| `auditor_minsa` | Auditor Institucional | `Minsa2026#` | `123456` |

*Nota: Para pruebas locales, además del secreto TOTP base32, el sistema admite el código de respaldo `123456`.*

---

## 📜 Declaración Académica y Protección de Datos

Este proyecto incluye un conjunto de datos sintéticos generados artificialmente con fines educativos y de demostración técnica. No contiene datos personales identificables reales, en estricto cumplimiento de los principios de confidencialidad y la normativa de protección de datos personales.

---

## 👨‍💻 Autor
**Jonathan Luis Rangel Villacorta**  
Estudiante de Ingeniería de Ciberseguridad — SENATI
