import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { MindmapNode, MindmapData } from "../src/types/shared_types.js";
import { app } from "electron";

const TEMP_BASE_DIR = path.join(app.getPath("temp"), "mindnote_temp");

async function ensureTempDir(tempDirPath: string) {
  await fs.mkdir(tempDirPath, { recursive: true });
  await fs.mkdir(path.join(tempDirPath, "text"), { recursive: true });
  await fs.mkdir(path.join(tempDirPath, "images"), { recursive: true });
}

export async function createDefaultMindmapData(): Promise<{
  mindmapData: MindmapData;
  markdownFiles: Record<string, string>;
}> {
  const rootNodeId = uuidv4();
  const rootMarkdownFile = `${uuidv4()}.md`;

  const mindmapData = {
    rootNode: {
      id: rootNodeId,
      text: "New Mindmap",
      children: [],
      markdown: rootMarkdownFile,
      images: [],
      type: "root",
      position: { x: 0, y: 0 },
    },
  };

  const markdownFiles: Record<string, string> = {
    [rootMarkdownFile]: "# New Mindmap",
  };

  return { mindmapData, markdownFiles };
}

export async function unpackMnFile(mnFilePath: string): Promise<{
  tempDirPath: string;
  mindmapData: MindmapNode;
  markdownFiles: Record<string, string>;
}> {
  const tempDirPath = await fs.mkdtemp(path.join(app.getPath("temp"), "mindnote-"));
  await ensureTempDir(tempDirPath);

  const zip = new AdmZip(mnFilePath);
  zip.extractAllTo(tempDirPath, true);

  //console.log(`Unpacked ${mnFilePath} to ${tempDirPath}`);

  const mapJsonContent = await readMarkdown(tempDirPath, "map.json");
  const mindmapData: MindmapNode = JSON.parse(mapJsonContent);

  const markdownFiles: Record<string, string> = {};
  const textDir = path.join(tempDirPath, "text");
  try {
    const files = await fs.readdir(textDir);
    for (const file of files) {
      if (path.extname(file) === ".md") {
        const content = await readMarkdown(
          tempDirPath,
          path.join("text", file),
        );
        markdownFiles[file] = content;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    console.warn(`Directory not found: ${textDir}. No markdown files loaded.`);
  }

  return { tempDirPath, mindmapData, markdownFiles };
}

export async function packMnFile(
  mnFilePath: string,
  tempDir: string,
  mindmapData: MindmapData, // 修正类型
  markdownFiles: Record<string, string>,
): Promise<void> {
  const textDir = path.join(tempDir, "text");
  const imagesDir = path.join(tempDir, "images");
  await fs.mkdir(textDir, { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });

  await saveMapJson(tempDir, mindmapData);

  //console.log("packMnFile markdownFiles:", markdownFiles);

  for (const fileName in markdownFiles) {
    try {
      //console.log("save markdownFile:", fileName);
      await saveMarkdown(
        tempDir,
        path.join("text", fileName),
        markdownFiles[fileName],
      );
    } catch (e) {
      console.error(`Failed to save markdown file: ${fileName}`, e);
      // 决定：是忽略这个文件的错误继续，还是抛出？
      // 如果这个文件是关键文件，则应该 `throw e;`
      throw e; // 如果希望报错，确保这里能打印出详细错误信息
    }
  }
  const zip = new AdmZip();
  zip.addLocalFile(path.join(tempDir, "map.json"), "");
  zip.addLocalFolder(textDir, "text");

  try {
    const imageFiles = await fs.readdir(imagesDir);
    if (imageFiles.length > 0) {
      zip.addLocalFolder(imagesDir, "images");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await fs.writeFile(mnFilePath, zip.toBuffer());
  //console.log(`Packed data to ${mnFilePath}`);
}

export async function readMarkdown(
  tempDirPath: string,
  relativeFilePath: string,
): Promise<string> {
  const filePath = path.join(tempDirPath, relativeFilePath);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`File not found: ${filePath}. Returning empty string.`);
      return "";
    }
    throw error;
  }
}

export async function saveMarkdown(
  tempDirPath: string,
  relativeFilePath: string,
  content: string,
): Promise<void> {
  const filePath = path.join(tempDirPath, relativeFilePath);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function saveMapJson(
  tempDirPath: string,
  mapJson: MindmapData, // 修正类型
): Promise<void> {
  const filePath = path.join(tempDirPath, "map.json");
  await fs.writeFile(filePath, JSON.stringify(mapJson, null, 2), "utf-8");
}

export async function saveImage(
  tempDirPath: string,
  base64Data: string,
): Promise<string> {
  const matches = base64Data.match(/^data:image\/([a-zA-Z0-9]+);base64,(.*)$/);
  if (!matches || matches.length < 3) {
    throw new Error("Invalid base64 image data format.");
  }
  const extension = matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  const imageName = `${uuidv4()}.${extension}`;
  const imagePath = path.join(tempDirPath, "images", imageName);
  await fs.writeFile(imagePath, buffer);
  return imageName;
}
