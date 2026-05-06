import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './src/db/schema';

dotenv.config();
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function checkRolePermissions() {
  const { permissions, roles, rolePermissions } = schema;
  
  // Get OWNER role
  const ownerRole = await db.select().from(schema.roles).where(eq(schema.roles.name, 'OWNER'));
  if (ownerRole.length === 0) {
    console.log('OWNER role not found');
    await client.end();
    return;
  }
  
  console.log('OWNER role ID:', ownerRole[0].id);
  
  // Get all permissions for OWNER role
  const ownerPerms = await db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, ownerRole[0].id));
  
  console.log('OWNER role permissions count:', ownerPerms.length);
  
  // Get the schedule manage permission
  const schedulePerm = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, 'expenses.schedule.manage'));
  
  console.log('expenses.schedule.manage permission:', schedulePerm);
  
  if (schedulePerm.length > 0) {
    const hasSchedulePerm = ownerPerms.some(rp => rp.permissionId === schedulePerm[0].id);
    console.log('OWNER has expenses.schedule.manage:', hasSchedulePerm);
    
    if (!hasSchedulePerm) {
      console.log('Assigning expenses.schedule.manage to OWNER role...');
      await db.insert(rolePermissions).values({
        roleId: ownerRole[0].id,
        permissionId: schedulePerm[0].id,
      });
      console.log('Assigned successfully');
    }
  }
  
  await client.end();
}
checkRolePermissions().catch(console.error);
