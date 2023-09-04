import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Liquid } from "liquidjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LiquidEngine = new Liquid({ globals: {} });

class PromptManager {
  constructor() {
    this.prompts = {};
    this.partials = {};
    this.config = {
      sourceDirectory: "../prompts",
    };
  }

  async init(config) {
    this.config = deepMerge(this.config, config);
    await this.gatherPrompts();
    await this.gatherPartials();
  }

  async gatherPrompts() {
    const fullPath = path.join(__dirname, this.config.sourceDirectory);

    const items = await fs.promises.readdir(fullPath);

    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const stats = await fs.promises.stat(itemPath);
      const isIndex = item === "index.js";

      if (stats.isFile()) {
        const promptModule = await import(itemPath);

        const promptsInThisModule = {
          ...promptModule.default,
          ...promptModule,
        };

        delete promptsInThisModule.default;

        if (isIndex) {
          this.prompts = deepMerge(this.prompts, promptsInThisModule);
        } else {
          const prop = item.replace(".js", "");
          this.prompts[prop] = deepMerge(
            this.prompts[prop] || {},
            promptsInThisModule
          );
        }
      }
    }

    return;
  }

  async gatherPartials() {
    const fullPath = path.join(__dirname, this.config.sourceDirectory);
    try {
      const partialsModule = await import(path.join(fullPath, "partials.js"));

      const partialsInThisModule = deepMerge(
        { ...partialsModule.default },
        { ...partialsModule }
      );

      delete partialsInThisModule.default;

      this.partials = deepMerge(this.partials || {}, partialsModule);
    } catch (e) {
      console.log("No partials file");
    }
  }

  getPrompt(promptPath, variables) {
    const promptPreInjection = _get(this.prompts, promptPath) || "";
    // console.log({ variables });
    // console.log({ promptPreInjection, partials: this.partials });

    const finalInputs = deepMerge(
      { partials: this.partials },
      { inputs: variables }
    );
    console.log({ finalInputs });
    const final = LiquidEngine.parseAndRenderSync(
      promptPreInjection,
      finalInputs
    );

    console.log({ final });

    // console.log({ final });

    return final.trim();
  }
}

const manager = new PromptManager();

export default manager;

function _get(object, dotNotation) {
  const keys = dotNotation.split(".");
  let currentObj = object;

  for (const key of keys) {
    if (!currentObj.hasOwnProperty(key)) {
      return undefined;
    }
    currentObj = currentObj[key];
  }

  return currentObj;
}

function _set(object, dotNotation, value) {
  const keys = dotNotation.split(".");
  let currentObj = object;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!currentObj.hasOwnProperty(key)) {
      currentObj[key] = {};
    }
    currentObj = currentObj[key];
  }

  currentObj[keys[keys.length - 1]] = value;
}

function deepMerge(target, ...sources) {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}
