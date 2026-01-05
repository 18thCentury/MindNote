import { createClient, WebDAVClient, FileStat } from "webdav";
import path from "path";
import fs from "fs/promises";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import * as fileOperations from "./fileOperations.js";
import { MindmapData } from "../src/types/shared_types.js";

// Helper to create client
export function getWebDavClient(url: string, username?: string, password?: string): WebDAVClient {
    return createClient(url, {
        username,
        password,
    });
}

// Check connection
export async function checkConnection(client: WebDAVClient): Promise<boolean> {
    try {
        await client.stat("/");
        return true;
    } catch (error) {
        console.error("WebDAV connection check failed:", error);
        return false;
    }
}

// Read directory
export async function readDirectory(client: WebDAVClient, remotePath: string): Promise<any[]> {
    const items = await client.getDirectoryContents(remotePath);
    return items as any[]; // Type assertion might be needed depending on lib version
}

// Open .mn file from WebDAV
// 1. Download to a temp zip file
// 2. Use fileOperations.unpackMnFile to unpack
// 3. Return the data
export async function openWebDavFile(
    client: WebDAVClient,
    remoteFilePath: string
): Promise<{
    tempDirPath: string;
    mindmapData: MindmapData;
    markdownFiles: Record<string, string>;
    localZipPath: string; // The downloaded temp zip
}> {
    // Create a temp file for the download
    const tempZipPath = path.join(app.getPath("temp"), `webdav-${uuidv4()}.mn`);

    // Download
    const buffer = await client.getFileContents(remoteFilePath, { format: "binary" }) as Buffer;
    await fs.writeFile(tempZipPath, buffer);

    // Unpack
    const { tempDirPath, mindmapData, markdownFiles } = await fileOperations.unpackMnFile(tempZipPath);

    // We should keep the tempZipPath or delete it?
    // We might want to keep it if we need to "save" by just updating it, but usually we repack.
    // For now, let's return it so we can reference it if needed, or we can just ignore it.

    return { tempDirPath, mindmapData, markdownFiles, localZipPath: tempZipPath };
}

// Create directory
export async function createDirectory(client: WebDAVClient, remotePath: string): Promise<void> {
    await client.createDirectory(remotePath);
}

// Delete file or directory
export async function deleteFile(client: WebDAVClient, remotePath: string): Promise<void> {
    await client.deleteFile(remotePath);
}

// Rename/Move file or directory
export async function renameFile(client: WebDAVClient, sourcePath: string, targetPath: string): Promise<void> {
    await client.moveFile(sourcePath, targetPath);
}

// Save .mn file to WebDAV
// 1. Use fileOperations.packMnFile to pack to a temp zip
// 2. Upload the buffer/file to WebDAV
export async function saveWebDavFile(
    client: WebDAVClient,
    remoteFilePath: string,
    tempDir: string,
    mindmapData: MindmapData,
    markdownFiles: Record<string, string>
): Promise<void> {
    // Create a temporary path for the packed file
    const tempZipPath = path.join(app.getPath("temp"), `webdav-save-${uuidv4()}.mn`);

    try {
        // Pack
        await fileOperations.packMnFile(tempZipPath, tempDir, mindmapData, markdownFiles);

        // Read buffer
        const buffer = await fs.readFile(tempZipPath);

        // Upload
        await client.putFileContents(remoteFilePath, buffer, { overwrite: true });

    } finally {
        // Cleanup temp zip
        try {
            await fs.unlink(tempZipPath);
        } catch (e) {
            console.warn("Failed to delete temp save file", e);
        }
    }
}
