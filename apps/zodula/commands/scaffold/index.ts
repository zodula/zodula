import { Command } from "nailgun";
import { loader } from "../../server/loader";
import { logger } from "../../server/logger";
import { startup } from "../../server/startup";
import inquirer from "inquirer";
import { $ } from "bun";
import path from "path";
import fs from "fs";

export default new Command("scaffold")
  .description("Scaffold new app, doctype, action, background, or extend")
  .argument(
    "[type]",
    "Type of scaffold: app, doctype, action, background, or extend"
  )
  .action(async (type) => {
    await startup();

    let scaffoldType = type;

    // If no type provided, prompt user to choose
    if (!scaffoldType) {
      const { type: selectedType } = await inquirer.prompt([
        {
          type: "list",
          name: "type",
          message: "What would you like to scaffold?",
          choices: [
            { name: "App", value: "app" },
            { name: "Doctype", value: "doctype" },
            { name: "Action", value: "action" },
            { name: "Background", value: "background" },
            { name: "Extend", value: "extend" },
          ],
        },
      ]);
      scaffoldType = selectedType;
    }

    // Validate the type
    if (
      !["app", "doctype", "action", "background", "extend"].includes(
        scaffoldType
      )
    ) {
      logger.error(
        `Invalid scaffold type: ${scaffoldType}. Must be one of: app, doctype, action, background, extend`
      );
      return;
    }

    switch (scaffoldType) {
      case "app":
        await scaffoldApp();
        break;
      case "doctype":
        await scaffoldDoctype();
        break;
      case "action":
        await scaffoldAction();
        break;
      case "background":
        await scaffoldBackground();
        break;
      case "extend":
        await scaffoldExtend();
        break;
    }
  });

async function scaffoldApp() {
  const { appName, description } = await inquirer.prompt([
    {
      type: "input",
      name: "appName",
      message: "App name:",
      validate: (input: string) => {
        if (!input.trim()) return "App name is required";
        if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
          return "App name must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "description",
      message: "App description:",
      default: "",
    },
  ]);

  const appDir = `apps/${appName}`;

  // Check if app already exists
  if (await Bun.file(appDir).exists()) {
    logger.error(`App ${appName} already exists`);
    return;
  }

  logger.info(`Creating app: ${appName}`);

  // Create app directory structure
  await $`mkdir -p ${appDir}/doctypes/core`;
  await $`mkdir -p ${appDir}/scripts/core`;
  await $`mkdir -p ${appDir}/actions`;
  await $`mkdir -p ${appDir}/migrations`;
  await $`mkdir -p ${appDir}/fixtures`;
  await $`mkdir -p ${appDir}/background`;
  await $`mkdir -p ${appDir}/translations/core`;
  await $`mkdir -p ${appDir}/ui`;
  await $`mkdir -p ${appDir}/ui/pages`;
  await $`mkdir -p ${appDir}/ui/components`;
  await $`mkdir -p ${appDir}/ui/lib`;
  await $`mkdir -p ${appDir}/ui/styles`;
  await $`mkdir -p ${appDir}/ui/utils`;
  await $`mkdir -p ${appDir}/ui/hooks`;
  await $`mkdir -p ${appDir}/ui/types`;

  // Create package.json
  const packageJson = {
    name: appName,
    type: "module",
    exports: {
      "./ui": "./ui/index.tsx",
      ".": "./src/client/index.ts",
      "./server": "./src/server/index.ts",
    },
    devDependencies: {
      "@types/bun": "latest",
    },
    peerDependencies: {
      typescript: "^5",
    },
    idx: 999,
    nailgun: {
      commands: [],
    },
    dependencies: {},
  };

  await Bun.write(
    `${appDir}/package.json`,
    JSON.stringify(packageJson, null, 2)
  );

  await $`mkdir -p ${appDir}/src/server`;
  await $`mkdir -p ${appDir}/src/client`;
  await Bun.write(`${appDir}/src/server/index.ts`, ``);
  await Bun.write(`${appDir}/src/client/index.ts`, ``);
  await Bun.write(`${appDir}/ui/index.tsx`, ``);
  await Bun.write(
    `${appDir}/ui/pages/shell.tsx`,
    `interface ShellProps {
    children: React.ReactNode
}

export default function Shell(props: ShellProps) {
    return (
        <>
            {props.children}
        </>
    )
}`
  );

  // Create .gitignore file
  const gitignoreContent = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
dist/
build/
out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
public

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Database files
*.db
*.sqlite
*.sqlite3

# Zodula specific
.zodula/
`;

  await Bun.write(`${appDir}/.gitignore`, gitignoreContent);

  // Create README.md
  const readmeContent = `# ${appName.charAt(0).toUpperCase() + appName.slice(1)}

${description ? description : `A custom application built on [Zodula](https://github.com/zodula/zodula) framework.`}

## Quick Start

\`\`\`bash
# Install nailgun globally
bun install --global nailgun

# Create a zodula project
nailgun create my-app --branch v0

cd my-app

# Install ${appName} app
nailgun install-app @zodula/${appName} --branch v0

# Start development
nailgun dev
# or
nailgun start
\`\`\`

## Structure

- \`doctypes/\` - Data models and business logic
- \`actions/\` - API endpoints and server logic
- \`ui/\` - Frontend components and pages
- \`migrations/\` - Database schema changes
- \`fixtures/\` - Sample data and initial setup
- \`background/\` - Background jobs and scheduled tasks

## Development

\`\`\`bash
# Start development server
nailgun dev

# Generate database migrations
nailgun generate

# Apply migrations
nailgun migrate

# Build for production
nailgun build
\`\`\`

## Contributing

This app is part of the Zodula ecosystem. For more information, visit [Zodula Documentation](https://github.com/zodula/zodula).
`;

  await Bun.write(`${appDir}/README.md`, readmeContent);

  // Initialize git repository
  logger.info(`Initializing git repository...`);
  await $`cd ${appDir} && git init`;
  await $`cd ${appDir} && git add .`;
  await $`cd ${appDir} && git commit -m "Initial commit: scaffold ${appName} app"`;

  logger.success(`App ${appName} created successfully!`);
  logger.info(`Next steps:`);
  logger.info(`1. Run 'nailgun migrate' to sync schema`);
  logger.info(`2. Run 'nailgun dev' to start development`);
}

async function scaffoldDoctype() {
  // Get available apps
  const apps = loader.from("app").list();
  if (apps.length === 0) {
    logger.error("No apps found. Create an app first.");
    return;
  }

  const { appName, doctypeName, domain, label, isSubmittable } =
    await inquirer.prompt([
      {
        type: "list",
        name: "appName",
        message: "Select app:",
        choices: apps.map((app) => ({
          name: `${app.packageName} (${app.folder})`,
          value: app.packageName,
        })),
      },
      {
        type: "input",
        name: "doctypeName",
        message: "Doctype name (e.g., Customer, Product):",
        validate: (input: string) => {
          if (!input.trim()) return "Doctype name is required";
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(input)) {
            return "Doctype name must start with uppercase letter and contain only letters and numbers";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "domain",
        message: "Domain (folder name):",
        default: "core",
        validate: (input: string) => {
          if (!input.trim()) return "Domain is required";
          if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
            return "Domain must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "label",
        message: "Label (display name):",
        default: (answers: any) => answers.doctypeName,
      },
      {
        type: "confirm",
        name: "isSubmittable",
        message: "Is this doctype submittable?",
        default: false,
      },
    ]);

  const app = apps.find((a) => a.packageName === appName);
  if (!app) {
    logger.error(`App ${appName} not found`);
    return;
  }

  const doctypeDir = `${app.dir}/doctypes/${domain}`;
  const doctypeFile = `${doctypeDir}/${doctypeName}.doctype.ts`;

  // Check if doctype already exists
  if (await Bun.file(doctypeFile).exists()) {
    logger.error(`Doctype ${doctypeName} already exists in ${domain} domain`);
    return;
  }

  logger.info(`Creating doctype: ${doctypeName} in ${appName}/${domain}`);

  // Create domain directory if it doesn't exist
  await $`mkdir -p ${doctypeDir}`;

  // Create doctype file
  const doctypeContent = `
export default $doctype<"${appName}__${doctypeName}">({
    name: {
        type: "text",
        label: "Name",
        required: 1,
        unique: 1,
        in_list_view: 1
    },
    // Add more fields as needed
}, {
    label: "${label}",
    is_submittable: ${isSubmittable ? 1 : 0},
    search_fields: "name"
})
`;

  await Bun.write(doctypeFile, doctypeContent);

  logger.success(`Doctype ${doctypeName} created successfully!`);
  logger.info(`File: ${doctypeFile}`);
  logger.info(`Next steps:`);
  logger.info(`1. Add fields to the doctype`);
  logger.info(`2. Run 'nailgun generate' to create migration`);
  logger.info(`3. Run 'nailgun migrate' to apply changes`);
}

async function scaffoldAction() {
  const { actionPath } = await inquirer.prompt([
    {
      type: "input",
      name: "actionPath",
      message: "Action path (e.g., zodula.core.print, zerp.report.sales):",
      validate: (input: string) => {
        if (!input.trim()) return "Action path is required";
        if (
          !/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*\.[a-z][a-z0-9_]*$/.test(input)
        ) {
          return "Action path must be in format: app.module.action (e.g., zodula.core.print)";
        }
        return true;
      },
    },
  ]);

  const [appName, module, actionName] = actionPath.split(".");

  // Get available apps
  const apps = loader.from("app").list();
  const app = apps.find((a) => a.packageName === appName);
  if (!app) {
    logger.error(`App ${appName} not found`);
    return;
  }

  const actionsDir = `${app.dir}/actions`;
  const actionFile = `${actionsDir}/${module}.ts`;

  logger.info(`Creating action: ${actionName} in ${appName}/${module}`);

  // Create actions directory if it doesn't exist
  await $`mkdir -p ${actionsDir}`;

  // Check if action file exists
  const fileExists = await Bun.file(actionFile).exists();

  if (fileExists) {
    // Read existing file and append new action
    const existingContent = await Bun.file(actionFile).text();
    const newAction = `

export default $action(async ctx => {
    // TODO: Implement ${actionName} logic
    return ctx.json({
        message: "${actionName} action executed"
    });
}, {
    // TODO: Add request/response schemas
    response: {
        200: z.object({
            message: z.string()
        })
    }
});
`;

    await Bun.write(actionFile, existingContent + newAction);
  } else {
    // Create new action file
    const actionContent = `import { z } from "bxo";

export default $action(async ctx => {
    // TODO: Implement ${actionName} logic
    return ctx.json({
        message: "${actionName} action executed"
    });
}, {
    // TODO: Add request/response schemas
    response: {
        200: z.object({
            message: z.string()
        })
    }
});
`;

    await Bun.write(actionFile, actionContent);
  }

  logger.success(`Action ${actionName} created successfully!`);
  logger.info(`File: ${actionFile}`);
  logger.info(`Next steps:`);
  logger.info(`1. Implement the action logic`);
  logger.info(`2. Add request/response schemas`);
  logger.info(`3. Test the action via API`);
}

async function scaffoldBackground() {
  const { backgroundPath } = await inquirer.prompt([
    {
      type: "input",
      name: "backgroundPath",
      message:
        "Background job path (e.g., zodula.core.email, zerp.report.sales):",
      validate: (input: string) => {
        if (!input.trim()) return "Background job path is required";
        if (
          !/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*\.[a-z][a-z0-9_]*$/.test(input)
        ) {
          return "Background job path must be in format: app.module.job (e.g., zodula.core.email)";
        }
        return true;
      },
    },
  ]);

  const [appName, module, backgroundName] = backgroundPath.split(".");

  // Get available apps
  const apps = loader.from("app").list();
  const app = apps.find((a) => a.packageName === appName);
  if (!app) {
    logger.error(`App ${appName} not found`);
    return;
  }

  const backgroundDir = `${app.dir}/background`;
  const backgroundFile = `${backgroundDir}/${backgroundName}.ts`;

  // Check if background job already exists
  if (await Bun.file(backgroundFile).exists()) {
    logger.error(`Background job ${backgroundName} already exists`);
    return;
  }

  logger.info(
    `Creating background job: ${backgroundName} in ${appName}/${module}`
  );

  // Create background directory if it doesn't exist
  await $`mkdir -p ${backgroundDir}`;

  // Create background job file
  const backgroundContent = `export default $background(async (ctx) => {
    // TODO: Implement ${backgroundName} background job logic
    console.log("Running ${backgroundName} background job");
    
    // Example: Process data
    // const data = ctx.data;
    // await processData(data);
    
    return {
        success: true,
        message: "${backgroundName} completed successfully"
    };
});

// Example usage:
// await ${backgroundName}.enqueue({ data: "example data" });
`;

  await Bun.write(backgroundFile, backgroundContent);

  logger.success(`Background job ${backgroundName} created successfully!`);
  logger.info(`File: ${backgroundFile}`);
  logger.info(`Next steps:`);
  logger.info(`1. Implement the background job logic`);
  logger.info(`2. Configure job options (retry, timeout, queue)`);
  logger.info(`3. Enqueue the job from your actions or other parts of the app`);
}

async function scaffoldExtend() {
  // Get available apps
  const apps = loader.from("app").list();
  if (apps.length === 0) {
    logger.error("No apps found. Create an app first.");
    return;
  }

  // Get available doctypes for reference
  const doctypes = loader.from("doctype").list();
  const doctypeChoices = doctypes.map((dt) => ({
    name: `${dt.name} (${dt.appName})`,
    value: dt.name,
  }));

  // Build prompts array
  const prompts: any[] = [
    {
      type: "list",
      name: "appName",
      message: "Select app:",
      choices: apps.map((app) => ({
        name: `${app.packageName} (${app.folder})`,
        value: app.packageName,
      })),
    },
    {
      type: "input",
      name: "domain",
      message: "Domain (folder name in scripts):",
      default: "core",
      validate: (input: string) => {
        if (!input.trim()) return "Domain is required";
        if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
          return "Domain must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores";
        }
        return true;
      },
    },
  ];

  // Add doctype prompt based on availability
  if (doctypeChoices.length > 0) {
    prompts.push({
      type: "list",
      name: "doctypeName",
      message: "Select doctype to extend:",
      choices: doctypeChoices,
    });
  } else {
    prompts.push({
      type: "input",
      name: "doctypeName",
      message: "Doctype name to extend (e.g., zodula__User):",
      validate: (input: string) => {
        if (!input.trim()) return "Doctype name is required";
        return true;
      },
    });
  }

  prompts.push({
    type: "list",
    name: "event",
    message: "Select event type:",
    choices: [
      { name: "before_insert", value: "before_insert" },
      { name: "after_insert", value: "after_insert" },
      { name: "before_update", value: "before_update" },
      { name: "after_update", value: "after_update" },
      { name: "before_delete", value: "before_delete" },
      { name: "after_delete", value: "after_delete" },
      { name: "before_submit", value: "before_submit" },
      { name: "after_submit", value: "after_submit" },
      { name: "before_cancel", value: "before_cancel" },
      { name: "after_cancel", value: "after_cancel" },
    ],
    default: "before_insert",
  });

  const { appName, domain, doctypeName, event } =
    await inquirer.prompt(prompts);

  const app = apps.find((a) => a.packageName === appName);
  if (!app) {
    logger.error(`App ${appName} not found`);
    return;
  }

  const scriptsDir = `${app.dir}/scripts/${domain}`;
  const extendFile = `${scriptsDir}/${doctypeName}.extend.ts`;

  // Check if extend file already exists
  if (await Bun.file(extendFile).exists()) {
    logger.error(
      `Extend file for ${doctypeName} already exists in ${domain} domain`
    );
    return;
  }

  logger.info(`Creating extend file: ${doctypeName} in ${appName}/${domain}`);

  // Create scripts domain directory if it doesn't exist
  await $`mkdir -p ${scriptsDir}`;

  // Create extend file
  const extendContent = `export default $extend((ctx) => {
  ctx.on("${doctypeName}", "${event}", async ({ doc }) => {
    // TODO: Implement ${event} logic for ${doctypeName}
    // Example:
    // if (event === "before_insert") {
    //   // Modify doc before insert
    // }
  });
});
`;

  await Bun.write(extendFile, extendContent);

  logger.success(`Extend file for ${doctypeName} created successfully!`);
  logger.info(`File: ${extendFile}`);
  logger.info(`Next steps:`);
  logger.info(`1. Implement the ${event} logic`);
  logger.info(`2. Add more event handlers as needed`);
  logger.info(
    `3. The extend will be automatically loaded when the server starts`
  );
}
