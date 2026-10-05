import { GoogleGenAI } from "@google/genai";
import readlinesync from "readline-sync";
import fs from "fs";
import path from "path";
import os from "os";
import "dotenv/config"; 

const platform = os.platform();
const History = [];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, 
})

async function createFolder({ folderPath }) {
  try {
    fs.mkdirSync(folderPath, { recursive: true });
    return `success: created folder ${folderPath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function writeFile({ filePath, content }) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    return `success: wrote ${filePath} (${content.length} chars)`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

const createFolderDeclaration = {
  name: "createFolder",
  description: "Create a project folder (and any nested subfolders).",
  parameters: {
    type: "OBJECT",
    properties: {
      folderPath: {
        type: "STRING",
        description: "Relative folder path to create, e.g. 'coding-platform'",
      },
    },
    required: ["folderPath"],
  },
};

const writeFileDeclaration = {
  name: "writeFile",
  description:
    "Create or overwrite a file with the given content. Use this for index.html, style.css, script.js, etc. Always pass the FULL file content in one call, never a snippet.",
  parameters: {
    type: "OBJECT",
    properties: {
      filePath: {
        type: "STRING",
        description: "Relative file path, e.g. 'coding-platform/index.html'",
      },
      content: {
        type: "STRING",
        description: "The complete text content to write into the file.",
      },
    },
    required: ["filePath", "content"],
  },
};

const availableTools = {
  createFolder,
  writeFile,
};

async function runAgent(userProblem) {
  History.push({
    role: "user",
    parts: [{ text: userProblem }],
  });

  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", 
      contents: History,
      config: {
        systemInstruction: `You are a website builder agent. You build real, complete, working websites directly on disk using your tools — you never ask the user to run any terminal command yourself.

Current OS: ${platform} (irrelevant — you only use tools, never shell commands).

Your job, every single time:
1. Understand what kind of website the user wants from their prompt.
2. Call createFolder once to make the project folder (pick a sensible folder name from the request).
3. Call writeFile for index.html, then style.css, then script.js (and any other files you decide you need) — each call must contain the COMPLETE file content, not a placeholder or snippet.
4. Write real, working, reasonably polished HTML/CSS/JS matching what the user asked for — real headings, real copy, real layout and styling, not a bare skeleton.
5. Only after all files are written, reply in plain text (no more tool calls) with a short summary: what you built, the folder name, and that they should open index.html in a browser.

Never output PowerShell, bash, mkdir, touch, or any other shell command as text. Never ask the user to paste or run anything. Use only createFolder and writeFile.`,
        tools: [
          {
            functionDeclarations: [createFolderDeclaration, writeFileDeclaration],
          },
        ],
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const { name, args } = response.functionCalls[0];
      const func = availableTools[name];
      const result = await func(args);

      console.log(`\n> ${name}(${JSON.stringify(args).slice(0, 80)}...)`);
      console.log(`  ${result}`);

      
      History.push(response.candidates[0].content);

      History.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name,
              response: { result },
            },
          },
        ],
      });
    } else {
      History.push(response.candidates[0].content);
      
      console.log("\n" + response.text);
      break;
    }
  }
}

async function main() {
  console.log("I am a Cursor: let's create a website");
  const userProblem = readlinesync.question("ask me anything: ");
  console.log("\nBuilding...\n");
  await runAgent(userProblem);
  main();
}

main();
