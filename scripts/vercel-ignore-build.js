#!/usr/bin/env node
/**
 * Vercel Ignored Build Step Script
 * 
 * Regla de Vercel:
 * - Exit code 1: Vercel PROCEDE con el build y despliegue de la web.
 * - Exit code 0: Vercel CANCELA / OMITE el build (no gasta minutos de build ni despliega).
 * 
 * Objetivo:
 * Evitar que los commits que solo tocan la app móvil (`mobile/`) o documentación
 * provoquen builds innecesarios de la web en Vercel, optimizando tiempos y rendimiento.
 */

const { execSync } = require('child_process');

function shouldBuild() {
  const prevSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA;

  let diffCommand = 'git diff --name-only HEAD^ HEAD';
  if (prevSha && currentSha) {
    diffCommand = `git diff --name-only ${prevSha} ${currentSha}`;
  }

  let changedFiles = [];
  try {
    const output = execSync(diffCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    changedFiles = output.split('\n').map(f => f.trim()).filter(Boolean);
  } catch (err) {
    // Si falla git diff (p. ej. clon superficial, primer commit), procedemos por seguridad
    console.log('[Vercel Build Check] No se pudo obtener git diff. Procediendo con el build por precaución.');
    return true;
  }

  if (changedFiles.length === 0) {
    console.log('[Vercel Build Check] No se detectaron archivos modificados. Omitiendo build.');
    return false;
  }

  console.log(`[Vercel Build Check] Archivos modificados detectados (${changedFiles.length}):`);
  changedFiles.forEach(f => console.log(`  - ${f}`));

  // Directorios y archivos que afectan directamente a la aplicación web
  const webPrefixes = ['src/', 'public/', 'shared/'];
  const webRootFiles = [
    'index.html',
    'package.json',
    'package-lock.json',
    'vite.config.js',
    'vercel.json',
    '.vercelignore',
    'tsconfig.json'
  ];

  const hasWebChanges = changedFiles.some(file => {
    const normalized = file.replace(/\\/g, '/');

    // Descartar explícitamente la carpeta mobile
    if (normalized.startsWith('mobile/')) {
      return false;
    }

    // Descartar documentación, agentes y tests que no afectan a la web en producción
    if (
      normalized.startsWith('tests/') ||
      normalized.startsWith('docs/') ||
      normalized.startsWith('.agents/') ||
      normalized.startsWith('.claude/') ||
      normalized.endsWith('.md') ||
      normalized.endsWith('.html') && normalized !== 'index.html'
    ) {
      return false;
    }

    // Cambios en carpetas de la web
    if (webPrefixes.some(prefix => normalized.startsWith(prefix))) {
      return true;
    }

    // Cambios en archivos de configuración de la web
    if (webRootFiles.includes(normalized)) {
      return true;
    }

    // Cualquier otro archivo no móvil en la raíz (p. ej. dependencias, utilidades)
    return true;
  });

  return hasWebChanges;
}

const proceed = shouldBuild();

if (proceed) {
  console.log('✅ [Vercel Build Check] Cambios en la web detectados. Continuando con el despliegue.');
  process.exit(1); // 1 = Procede con el build en Vercel
} else {
  console.log('🛑 [Vercel Build Check] Solo cambios en mobile o no-web. Despliegue de Vercel omitido con éxito.');
  process.exit(0); // 0 = Cancela/omite el build en Vercel
}
