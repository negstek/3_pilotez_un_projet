import type { FileHistoryItem, FilePublicMetadata, FileStatusFilter, FileUploadResponse } from '@datashare/shared-lib'
import { apiBlob, apiRequest } from './client.ts'

// Calls to the file routes (see docs/api-contract.yaml, `files` tag), typed with @datashare/shared-lib like the back.

export interface UploadOptions {
  /** Optional download password; omitted when empty. */
  password: string
  /** Lifetime of the link, between 1 and 7 days. */
  expiresInDays: number
}

/**
 * US01 / US07: 201 with the link to share; ApiError 401 (token sent but invalid or expired) or 422 (size, extension, password, duration).
 *
 * Sent as multipart/form-data, the file as the `file` part and the options as text fields (the back converts them).
 *
 * @param token JWT of the session, which attaches the file to the user's history; `null` for a visitor, whose upload is anonymous (US07).
 */
export function uploadFile(file: File, { password, expiresInDays }: UploadOptions, token: string | null): Promise<FileUploadResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('expiresInDays', String(expiresInDays))
  if (password) form.append('password', password)
  return apiRequest('/files', { method: 'POST', body: form, token })
}

/** US05: files of the logged-in user, filtered on the state of their link; ApiError 401 (session expired). */
export function listMyFiles(status: FileStatusFilter, token: string | null): Promise<FileHistoryItem[]> {
  return apiRequest(`/files?status=${status}`, { token })
}

/** US06: deletes a file of the logged-in user, irreversibly; ApiError 401, 403 (another user's file) or 404 (already deleted). */
export function deleteFile(id: string, token: string | null): Promise<void> {
  return apiRequest(`/files/${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

/** US02: metadata of a shared file; ApiError 404 (unknown link) or 410 (expired). */
export function getFileMetadata(downloadToken: string): Promise<FilePublicMetadata> {
  return apiRequest(`/f/${encodeURIComponent(downloadToken)}`)
}

/**
 * US02: content of the file; ApiError 401 (wrong password), 422 (missing password), 404 or 410. Public route, no token.
 *
 * @param password Password of a protected file; an empty string sends none.
 */
export function downloadFile(downloadToken: string, password: string): Promise<Blob> {
  return apiBlob(`/f/${encodeURIComponent(downloadToken)}/download`, {
    method: 'POST',
    body: password ? { password } : {},
  })
}
