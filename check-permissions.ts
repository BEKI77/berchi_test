import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './src/db/schema';

dotenv.config();
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function checkPermissions() {
  const { permissions, roles, rolePermissions } = schema;
  
  // Get OWNER role
  const ownerRole = await db.select().from(schema.roles).where(eq(schema.roles.name, 'OWNER'));
  console.log('OWNER role:', ownerRole);
  
  if (ownerRole.length > 0) {
    // Get all permissions for OWNER role
    const ownerPerms = await db
      .select({ 
        perm: permissions 
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, ownerRole[0].id));
    
    console.log('OWNER permissions count:', ownerPerms.length);
    const expensePerms = ownerPerms.filter(p => p.perm.name?.startsWith('expenses'));
    console.log('Expense permissions:', expensePerms.map(p => p.perm.name));
  }
  
  await client.end();
}
checkPermissions().catch(console.error);
