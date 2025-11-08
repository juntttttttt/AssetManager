import { calculateFileHash } from './fileValidation'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason: 'file-hash' | 'asset-id' | 'none'
  existingAsset?: {
    assetId: string
    name: string
    status: string
    createdAt: string
  }
}

/**
 * Check if a file is a duplicate by comparing file hash
 * Only considers it a duplicate if it's the same file AND same group (or both user uploads)
 */
export async function checkDuplicateByHash(
  fileHash: string,
  uploadType: 'audio' | 'decal',
  currentGroupId?: string
): Promise<DuplicateCheckResult> {
  try {
    const existingFiles = JSON.parse(
      localStorage.getItem(uploadType === 'audio' ? 'uploadedAudios' : 'uploadedDecals') || '[]'
    )
    
    // Normalize group IDs: undefined/null/empty string means user upload
    const normalizeGroupId = (groupId: string | undefined | null) => {
      return groupId?.trim() || 'user'
    }
    const normalizedCurrentGroupId = normalizeGroupId(currentGroupId)
    
    // Find duplicates, but only if they're for the same group/user
    const duplicate = existingFiles.find((existing: any) => {
      if (existing.fileHash !== fileHash) {
        return false
      }
      
      // Compare group IDs - only duplicate if same group
      const existingGroupId = normalizeGroupId(existing.groupId)
      return existingGroupId === normalizedCurrentGroupId
    })
    
    if (duplicate) {
      return {
        isDuplicate: true,
        reason: 'file-hash',
        existingAsset: {
          assetId: duplicate.assetId,
          name: duplicate.name,
          status: duplicate.status || 'unknown',
          createdAt: duplicate.createdAt || '',
        },
      }
    }
    
    return { isDuplicate: false, reason: 'none' }
  } catch (error) {
    console.error('Error checking duplicate by hash:', error)
    return { isDuplicate: false, reason: 'none' }
  }
}

/**
 * Check if an asset ID already exists
 */
export function checkDuplicateByAssetId(
  assetId: string,
  uploadType: 'audio' | 'decal'
): DuplicateCheckResult {
  try {
    const existingFiles = JSON.parse(
      localStorage.getItem(uploadType === 'audio' ? 'uploadedAudios' : 'uploadedDecals') || '[]'
    )
    
    const duplicate = existingFiles.find((existing: any) => existing.assetId === assetId)
    
    if (duplicate) {
      return {
        isDuplicate: true,
        reason: 'asset-id',
        existingAsset: {
          assetId: duplicate.assetId,
          name: duplicate.name,
          status: duplicate.status || 'unknown',
          createdAt: duplicate.createdAt || '',
        },
      }
    }
    
    return { isDuplicate: false, reason: 'none' }
  } catch (error) {
    console.error('Error checking duplicate by asset ID:', error)
    return { isDuplicate: false, reason: 'none' }
  }
}

/**
 * Comprehensive duplicate check (both hash and asset ID)
 * Only considers it a duplicate if it's the same file AND same group (or both user uploads)
 */
export async function checkDuplicate(
  file: File,
  uploadType: 'audio' | 'decal',
  assetId?: string,
  currentGroupId?: string
): Promise<DuplicateCheckResult> {
  // First check by asset ID if provided
  // Asset IDs are unique across all groups, so if same asset ID exists, it's always a duplicate
  if (assetId) {
    const assetIdCheck = checkDuplicateByAssetId(assetId, uploadType)
    if (assetIdCheck.isDuplicate) {
      return assetIdCheck
    }
  }
  
  // Then check by file hash, but consider group ID
  // Same file can be uploaded to different groups, so only duplicate if same group
  try {
    const fileHash = await calculateFileHash(file)
    return await checkDuplicateByHash(fileHash, uploadType, currentGroupId)
  } catch (error) {
    console.error('Error calculating file hash:', error)
    return { isDuplicate: false, reason: 'none' }
  }
}

/**
 * Get all duplicate files from a list of files
 */
export async function findDuplicates(
  files: File[],
  uploadType: 'audio' | 'decal'
): Promise<Map<string, DuplicateCheckResult>> {
  const duplicates = new Map<string, DuplicateCheckResult>()
  
  for (const file of files) {
    const result = await checkDuplicate(file, uploadType)
    if (result.isDuplicate) {
      duplicates.set(file.name, result)
    }
  }
  
  return duplicates
}

