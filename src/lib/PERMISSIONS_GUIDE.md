# Permission Management System Guide

## Overview

This salon ERP now features a comprehensive permission management system that allows administrators to control what pages and features different user roles (servers, cashiers, etc.) can access. The system is designed to be scalable and flexible as your business grows.

## Architecture

### Database Schema

The permission system consists of the following tables:

- **`permissions`**: Individual permissions (e.g., "appointments.create", "customers.view")
- **`roles`**: User roles (e.g., "SERVER", "CASHIER", "OWNER")
- **`role_permissions`**: Junction table linking roles to permissions
- **`user_permissions`**: User-specific permission overrides (grant/deny)
- **`permission_templates`**: Predefined permission sets for easy setup

### Permission Format

Permissions follow the format: `{resource}.{action}`

**Resources**: appointments, customers, services, inventory, orders, staff, reports, settings, billing
**Actions**: view, create, update, delete, manage_slots, checkout, export, permissions

## Default Permissions

### OWNER Role
- Full access to all permissions
- Can manage permissions and settings

### SERVER Role  
- Dashboard view
- Appointments: view, create, update
- Customers: view, create, update
- Services: view
- Inventory: view
- Orders: view, create, update
- Staff: view

### CASHIER Role
- Dashboard view
- Appointments: view
- Customers: view, update
- Services: view
- Inventory: view
- Orders: view, checkout
- Billing: view, create, update

## Usage Guide

### For Administrators

#### Accessing Permission Management
1. Go to **Settings** in the admin panel
2. Click **"Manage Permissions"** in the Permission Management section
3. Use the tabs to manage:
   - **Permissions**: View and create system permissions
   - **Roles**: Create and assign permissions to roles
   - **User Permissions**: Override role permissions for specific users

#### Creating New Permissions
1. Navigate to the **Permissions** tab
2. Click **"Add Permission"**
3. Fill in:
   - **Permission Name**: Format as "resource.action" (e.g., "products.delete")
   - **Resource**: The system area (e.g., "products")
   - **Action**: The operation (e.g., "delete")
   - **Description**: Optional description of what this permission controls

#### Creating New Roles
1. Navigate to the **Roles** tab
2. Click **"Add Role"**
3. Fill in role name and description
4. Select permissions from the checklist
5. Save the role

#### Managing User Overrides
1. Navigate to the **User Permissions** tab
2. Find the user you want to modify
3. Use the grant (checkmark) or deny (X) buttons for specific permissions
4. This overrides their role-based permissions

### For Developers

#### API Integration

To protect API routes with permissions:

```typescript
import { hasPermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const canView = await hasPermission(session.user.id, "services.view");
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Your API logic here
}
```

#### Using Permission Wrappers

For cleaner code, use the provided wrappers:

```typescript
import { withReadPermission, withCreatePermission } from "@/lib/api-wrapper";

export async function GET(request: NextRequest) {
  return withReadPermission(request, "services", async (req, userId) => {
    // Your logic here - userId is available
    return NextResponse.json(/* data */);
  });
}

export async function POST(request: NextRequest) {
  return withCreatePermission(request, "services", async (req, userId) => {
    // Your logic here
    return NextResponse.json(/* created data */);
  });
}
```

#### Frontend Permission Checks

For conditional UI rendering:

```typescript
import { hasPermission } from "@/lib/permissions";

function Component() {
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    async function checkPermission() {
      const session = await auth();
      if (session?.user?.id) {
        const hasCreatePermission = await hasPermission(session.user.id, "appointments.create");
        setCanCreate(hasCreatePermission);
      }
    }
    checkPermission();
  }, []);

  return (
    <div>
      {canCreate && (
        <Button>Create Appointment</Button>
      )}
    </div>
  );
}
```

#### Permission Groups

Use predefined permission groups for common checks:

```typescript
import { PERMISSION_GROUPS } from "@/lib/permissions";

// Check if user has any appointment permissions
const hasAnyAppointmentAccess = await hasAnyPermission(
  userId, 
  PERMISSION_GROUPS.APPOINTMENTS
);

// Check if user has full staff management access
const canManageStaff = await hasAllPermissions(
  userId,
  PERMISSION_GROUPS.STAFF_MANAGEMENT
);
```

## Migration from Role-Based System

The system maintains backward compatibility with the existing role-based middleware while adding the new permission system. Here's how to migrate:

### 1. Gradual Migration
- Existing role-based checks continue to work
- New features should use permission-based checks
- Gradually update existing API routes

### 2. Update Middleware
The middleware now supports both role-based and permission-based access control. You can gradually transition by:

1. Adding permissions for your roles
2. Updating API routes to use permission checks
3. Eventually removing hardcoded role checks

### 3. Database Migration
Run the migration to add permission tables:
```bash
npx drizzle-kit push
npx tsx src/db/seed_permissions.ts
```

## Best Practices

### 1. Principle of Least Privilege
- Give users only the permissions they need
- Start with minimal permissions and grant more as needed
- Use user-specific overrides for exceptions

### 2. Permission Naming
- Use consistent naming: `{resource}.{action}`
- Be descriptive but concise
- Group related permissions logically

### 3. Regular Audits
- Periodically review user permissions
- Remove unnecessary user overrides
- Update roles as business needs change

### 4. Performance Considerations
- Permission checks are cached for performance
- Cache is automatically cleared when permissions change
- Consider using permission groups for complex checks

## Troubleshooting

### Common Issues

1. **Permission Denied Unexpectedly**
   - Check if user has the required role permissions
   - Look for user-specific permission overrides that might deny access
   - Verify permission name matches exactly

2. **Performance Issues**
   - Permission checks are cached, but first check may be slower
   - Consider using permission groups for multiple checks
   - Monitor database query performance

3. **Database Connection Issues**
   - Ensure database is running and accessible
   - Check environment variables for database connection
   - Verify migration was applied successfully

### Debug Tips

- Enable debug logging to see permission check results
- Use the permission management UI to verify user permissions
- Check the database directly for permission assignments

## Future Enhancements

The permission system is designed to be extensible. Consider adding:

1. **Time-based permissions**: Permissions that expire or are valid during specific hours
2. **Location-based permissions**: Different permissions for different salon locations
3. **Audit logging**: Track when permissions are changed or used
4. **Permission templates**: More predefined templates for common use cases
5. **Bulk operations**: Apply permissions to multiple users at once

## Support

For issues or questions about the permission system:
1. Check this guide first
2. Review the API documentation
3. Look at existing implementations in the codebase
4. Contact the development team for complex issues
