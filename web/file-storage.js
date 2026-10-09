/** Shared storage adapter. New objects use R2; objects without an R2 record remain on Supabase Storage. */
function storageBucket(client, bucket) {
  if (window.GLL_CONFIG?.storageProvider !== "r2") return client.storage.from(bucket);
  const legacy = client.storage.from(bucket);

  async function invoke(action, payload = {}) {
    const { data, error } = await client.functions.invoke("file-storage", {
      body: { action, bucket, ...payload },
    });
    if (error) throw new Error(data?.error || "Não foi possível acessar o armazenamento de arquivos.");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function result(operation) {
    try { return { data: await operation(), error: null }; }
    catch (error) { return { data: null, error }; }
  }

  return {
    upload(path, file) {
      return result(async () => {
        const request = await invoke("request-upload", {
          path, fileName: file.name || path.split("/").at(-1), size: file.size,
        });
        try {
          const response = await fetch(request.url, {
            method: "PUT", headers: { "Content-Type": request.contentType, "If-None-Match": "*" }, body: file,
          });
          if (!response.ok) throw new Error("O envio ao R2 falhou. Tente novamente.");
          await invoke("complete-upload", { path: request.path });
          return { path: request.path };
        } catch (error) {
          await invoke("delete", { path: request.path }).catch(() => undefined);
          throw error;
        }
      });
    },
    download(path) {
      return result(async () => {
        const info = await invoke("download-url", { path });
        if (info.legacy) {
          const response = await legacy.download(path);
          if (response.error) throw response.error;
          return response.data;
        }
        const response = await fetch(info.url);
        if (!response.ok) throw new Error("Não foi possível baixar o arquivo do R2.");
        return response.blob();
      });
    },
    remove(paths) {
      return result(async () => {
        for (const path of paths) {
          const response = await invoke("delete", { path });
          if (response.legacy) {
            const legacyResult = await legacy.remove([path]);
            if (legacyResult.error) throw legacyResult.error;
          }
        }
        return paths;
      });
    },
    createSignedUrls(paths) {
      return result(async () => Promise.all(paths.map(async (path) => {
        const info = await invoke("download-url", { path });
        if (info.legacy) {
          const response = await legacy.createSignedUrl(path, 120);
          return { path, signedUrl: response.data?.signedUrl, error: response.error, expiresIn: 120 };
        }
        return { path, signedUrl: info.url, error: null, expiresIn: info.expiresIn };
      })));
    },
    createSignedUrl(path) {
      return result(async () => {
        const info = await invoke("download-url", { path });
        if (info.legacy) {
          const response = await legacy.createSignedUrl(path, 120);
          if (response.error) throw response.error;
          return response.data;
        }
        return { signedUrl: info.url };
      });
    },
    metadata(path) { return result(() => invoke("metadata", { path })); },
    exists(path) { return result(() => invoke("exists", { path })); },
  };
}
window.GLLFileStorage = { storageBucket };
