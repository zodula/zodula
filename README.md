# Zodula Framework

_The Modular Fullstack Framework Powered by Bun._

![Zodul Admin](/apps/zodula/assets/zodula-admin-mock.png)
![Code Usage](/apps/zodula/assets/code-usage.png)

## ✨ Features

- 🏗️ **Modular Architecture** - Namespace-based approach for scalable applications
- 👥 **Multi-Tenant Support** - User permission system for data isolation
- 🔐 **Role-Based Permissions** - Granular access control with user roles
- 🛡️ **Row-Level Security** - Doctype event-based data access control
- 🚀 **Auto-Generated CRUD APIs** - RESTful endpoints created automatically
- 📚 **OpenAPI Documentation** - Complete API documentation with interactive UI
- ⚡ **Real-time Updates** - Doctype event subscription with WebSocket support
- 🔄 **Database Schema Sync** - Automatic schema migration and synchronization
- 🖥️ **Admin Interface** - Built-in desk UI for data management
- 🎯 **Type-Safe** - Full TypeScript support from database to frontend
- 📝 **Audit Trail** - Complete change tracking and history
- 🌐 **Translation Support** - CSV-based internationalization system

## ⚠️ Important Notice

**Version 0 is experimental.** This version may have breaking changes and data loss during updates. Use only for development and testing.

## 🚀 Quick Start

**Requirements:**

- Bun v1.2.x+
- [Nailgun CLI](https://github.com/zodula/nailgun)

**Install:**

1. Install Nailgun CLI globally:

```bash
bun install --global nailgun
```

2. Create a new Zodula project:

```bash
nailgun create my-app --branch v0

cd my-app
```

3. Install the Zodula core app:

```bash
nailgun install-app @zodula/zodula --branch v0
```

This installs the Zodula framework core into your project's `apps/` directory.

**Start Development:**

```bash
nailgun dev
```

Server runs at `http://localhost:3000`

**Development Location:**

Develop your applications in the `apps/` folder. Create new apps using `nailgun scaffold app` or install existing apps using `nailgun install-app`.

## 🛠️ Common Commands

```bash
# Create a new project
nailgun create my-proj --branch v0

# Install an app from a repository
nailgun install-app @zodula/zerp --branch v0

# Scaffold (app, doctype, action, etc.)
nailgun scaffold

# Apply migrations and load data
nailgun migrate

# Create admin user
nailgun admin create-user --email me@example.com --password secret --roles "System Admin"

# Backup data (important before upgrades)
nailgun backup

# Restore from backup
nailgun restore

# Start development server
nailgun dev

# Start production server
nailgun start
```

## 📡 API & Development

**Auto-Generated REST APIs:**

- List: `GET /api/resources/{Doctype}`
- API Docs: `GET /openapi`

**TypeScript SDK:**

```ts
// Query data
const users = await $zodula
  .doctype("User")
  .select()
  .where("email", "=", "me@example.com");

// Create records
const user = await $zodula
  .doctype("User")
  .insert({ email: "me@example.com", password: "secret" });
```

## 🔄 Development Workflow

1. **Edit DocTypes** in `apps/*/doctypes/*`
2. **Apply changes:** `nailgun migrate`

## 🔄 Upgrading Zodula Core

### Development Environment

To upgrade the Zodula core app to the latest version for your branch (v0, v1, etc.):

1. **Create a backup (recommended):**

```bash
nailgun backup
```

2. **Upgrade the Zodula app:**

```bash
# Replace v0 with your version branch (v0, v1, etc.)
nailgun install-app @zodula/zodula --branch v0 --force
```

The `--force` flag will replace the existing Zodula app with the latest version from the specified branch.

3. **Update dependencies:**

```bash
bun install
```

4. **Apply any new migrations:**

```bash
nailgun migrate
```

**Note:** If you've made custom modifications to the Zodula core app, they will be overwritten. Consider creating your own app that extends Zodula functionality instead.

### Production Environment

**⚠️ Important:** For production upgrades, we strongly recommend using Docker and performing backup/restore operations to ensure data safety.

1. **Create a backup before upgrading:**

```bash
nailgun backup
```

This creates a timestamped backup in `.zodula_backup/` directory.

2. **Upgrade the Zodula app in your project:**

```bash
# Upgrade to latest version of your branch
nailgun install-app @zodula/zodula --branch v0 --force

# Update dependencies
bun install

# Apply migrations
nailgun migrate
```

3. **Use Docker for production deployments:**

Build and deploy using Docker containers to ensure consistent environments and easy rollback:

```bash
# Build Docker image
docker build -t my-zodula-app:latest .

# Stop and remove existing container (if upgrading)
docker stop my-zodula-app 2>/dev/null || true
docker rm my-zodula-app 2>/dev/null || true

# Start new container with updated image
docker run -d --name my-zodula-app \
  --restart unless-stopped \
  -v $(pwd)/.zodula_data:/app/.zodula_data \
  -v $(pwd)/.zodula_backup:/app/.zodula_backup \
  -p 3000:3000 \
  my-zodula-app:latest
```

**First-time setup:** If this is your first deployment, create the data directories:

```bash
mkdir -p .zodula_data .zodula_backup
```

4. **If upgrade fails, restore from backup:**

```bash
# Stop the container
docker stop my-zodula-app

# Restore from backup (run on host, not in container)
nailgun restore

# Restart container
docker start my-zodula-app
```

**Alternative:** You can also restore from within the container:

```bash
docker exec -it my-zodula-app nailgun restore
```

**Best Practices for Production:**

- Always create a backup before upgrading
- Test upgrades in a staging environment first
- Use Docker for consistent deployments
- Keep backups in a separate location (not just `.zodula_backup/`)
- Document your upgrade process and rollback procedures

## 🎯 What Makes Zodula Different

- **Type-First:** Full TypeScript from database to UI
- **Bun Native:** No Node.js required
- **Auto-Migrations:** Schema changes applied automatically
- **Real-time:** WebSocket updates built-in
