// Smoke del admin: sólo lucasm.alderete@gmail.com abre partidos.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { DEFAULT_ADMIN_EMAIL, isAdminEmail } = await import(pathToFileURL(path.join(root, 'src', 'auth', 'admin.js')).href);

let failures = 0;
const fail = (label) => { failures += 1; console.error(`  x FAIL: ${label}`); };
const assert = (condition, label) => { if (!condition) fail(label); };

console.log('== Admin del partido ==');
assert(DEFAULT_ADMIN_EMAIL === 'lucasm.alderete@gmail.com', 'el admin por defecto es el mail pedido');
assert(isAdminEmail('lucasm.alderete@gmail.com'), 'ese mail es admin');
assert(isAdminEmail('  LucasM.Alderete@gmail.com  '), 'mayúsculas y espacios no cambian el chequeo');
assert(!isAdminEmail('otro@gmail.com'), 'cualquier otro mail no es admin');
assert(!isAdminEmail(''), 'vacío no es admin');
assert(!isAdminEmail('lucasm.alderete@gmail.com', 'nina.v@example.com'), 'el env ADMIN_EMAIL puede cambiarlo');

if (failures) {
  console.error(`FALLAS: ${failures}`);
  process.exit(1);
}
console.log('TODO OK');
