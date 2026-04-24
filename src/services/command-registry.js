const fs = require("fs");
const path = require("path");

class CommandRegistry {
  constructor({ commandsRoot }) {
    this.commandsRoot = commandsRoot;
    this.commands = new Map();
    this.aliases = new Map();
  }

  load() {
    const files = this.listCommandFiles(this.commandsRoot);
    for (const file of files) {
      delete require.cache[require.resolve(file)];
      const command = require(file);
      this.validate(command, file);
      const name = command.meta.name.toLowerCase();
      this.commands.set(name, command);

      for (const alias of command.meta.aliases) {
        this.aliases.set(alias.toLowerCase(), name);
      }
    }
  }

  listCommandFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.listCommandFiles(fullPath));
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  validate(command, file) {
    if (!command || typeof command.execute !== "function" || !command.meta) {
      throw new Error(`Invalid command module: ${file}`);
    }

    const required = [
      "name",
      "aliases",
      "category",
      "description",
      "cooldownSeconds",
      "access",
      "chat",
    ];

    for (const key of required) {
      if (command.meta[key] === undefined) {
        throw new Error(`Command ${file} is missing meta.${key}`);
      }
    }
  }

  get(name) {
    if (!name) {
      return null;
    }

    const resolved = this.aliases.get(name.toLowerCase()) || name.toLowerCase();
    return this.commands.get(resolved) || null;
  }

  list() {
    return [...this.commands.values()].sort((left, right) =>
      left.meta.name.localeCompare(right.meta.name),
    );
  }

  grouped() {
    return this.list().reduce((accumulator, command) => {
      const key = command.meta.category;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(command);
      return accumulator;
    }, {});
  }
}

module.exports = {
  CommandRegistry,
};
