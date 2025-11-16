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

1. Fork this repository on GitHub
2. Clone your fork:

```bash
bun install --global nailgun

git clone https://github.com/YOUR_USERNAME/zodula-monorepo my-app

cd my-app

bun install
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/zodula/zodula-monorepo.git
```

**Start Development:**

```bash
nailgun dev
```

Server runs at `http://localhost:3000`

**Development Location:**

Develop your applications in the `apps/` folder. Create new apps or modify existing ones in this directory.

## 🛠️ Common Commands

```bash
# Scaffold
nailgun scaffold

# Apply migrations and load data
nailgun migrate

# Create admin user
nailgun admin create-user --email me@example.com --password secret --roles "System Admin"

# Backup data (important before upgrades)
nailgun backup

# Restore from backup
nailgun restore
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

To sync your fork with the latest Zodula core updates for your version branch (v0, v1, etc.):

1. **Check your current version branch:**

```bash
git branch --show-current
```

2. **Fetch upstream changes:**

```bash
git fetch upstream
```

3. **Merge upstream changes for your version:**

```bash
# Replace v0 with your version branch (v0, v1, etc.)
git checkout v0
git merge upstream/v0
```

4. **Preserve your README changes:**

If you've modified the README.md file, Git may show conflicts. To keep your version:

```bash
# If there's a merge conflict in README.md
git checkout --ours README.md
git add README.md
git commit -m "Merge upstream: preserve local README changes"
```

Alternatively, if you want to review changes first:

```bash
# Resolve conflicts manually, then:
git add README.md
git commit -m "Merge upstream: resolved README conflicts"
```

5. **Update dependencies:**

```bash
bun install
```

6. **Apply any new migrations:**

```bash
nailgun migrate
```

### Production Environment

**⚠️ Important:** For production upgrades, we strongly recommend using Docker and performing backup/restore operations to ensure data safety.

1. **Create a backup before upgrading:**

```bash
nailgun backup
```

This creates a timestamped backup in `.zodula_backup/` directory.

2. **Use Docker for production deployments:**

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

3. **If upgrade fails, restore from backup:**

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
docker exec -it my-zodula-app bun run apps/zodula/commands/restore
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
