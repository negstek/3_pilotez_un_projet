-- CreateTable
CREATE TABLE "file" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "password_hash" TEXT,
    "download_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_download_token_key" ON "file"("download_token");

-- CreateIndex
CREATE INDEX "file_owner_id_idx" ON "file"("owner_id");

-- CreateIndex
CREATE INDEX "file_expires_at_idx" ON "file"("expires_at");

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
