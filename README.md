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

```bash
bun install --global nailgun

git clone https://github.com/zodula/zodula my-app

cd my-app

bun install
```

**Start Development:**

```bash
nailgun dev
```

Server runs at `http://localhost:3000`

## 🛠️ Common Commands

```bash
# Scaffold
nailgun scaffold

# Apply migrations and load data
nailgun migrate

# Create admin user
nailgun admin create-user --email me@example.com --password secret --roles "System Admin"
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

## 🎯 What Makes Zodula Different

- **Type-First:** Full TypeScript from database to UI
- **Bun Native:** No Node.js required
- **Auto-Migrations:** Schema changes applied automatically
- **Real-time:** WebSocket updates built-in
