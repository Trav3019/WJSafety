// One-time bulk import: pushes existing Google Drive files into Supabase.
//
// 1. In Google Drive, download each of your folders (Acts and Regulations,
//    Emergency Response Plan, Equipment Inventory, Incident Report Forms,
//    SDS, Field Books) to your computer (right-click folder > Download).
// 2. Unzip them into one local folder so you have:
//      ./drive-export/Acts and Regulations/...
//      ./drive-export/Emergency Response Plan/...
//      ./drive-export/Equipment Inventory/...
//      ./drive-export/Incident Report Forms/...
//      ./drive-export/SDS/...
//      ./drive-export/Field Books/...
//    (the folder names must match the category names exactly)
// 3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (service role
//    key is in your Supabase project settings > API — keep it secret, never
//    commit it or ship it in the app).
// 4. Run: node scripts/import-documents.mjs ./drive-export

import { createClient } from '@supabase/supabase-js'
import { readdirSync, statSync, readFileSync } from 'fs'
import { join, extname } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const rootDir = process.argv[2]

if (!SUPABASE_URL || !SERVICE_KEY || !rootDir) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-documents.mjs ./drive-export')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const mimeByExt = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

async function main() {
  const { data: categories, error } = await supabase.from('categories').select('id, name')
  if (error) throw error
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]))

  const folders = readdirSync(rootDir).filter((f) => statSync(join(rootDir, f)).isDirectory())

  for (const folder of folders) {
    const categoryId = categoryByName.get(folder)
    if (!categoryId) {
      console.warn(`Skipping "${folder}" — no matching category in the database.`)
      continue
    }

    const dir = join(rootDir, folder)
    const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile())

    for (const file of files) {
      const fullPath = join(dir, file)
      const bytes = readFileSync(fullPath)
      const storagePath = `${categoryId}/${Date.now()}-${file}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, bytes, {
          contentType: mimeByExt[extname(file).toLowerCase()] ?? 'application/octet-stream',
        })

      if (uploadError) {
        console.error(`Failed to upload ${file}:`, uploadError.message)
        continue
      }

      const { error: insertError } = await supabase.from('documents').insert({
        category_id: categoryId,
        title: file.replace(extname(file), ''),
        storage_path: storagePath,
        file_type: mimeByExt[extname(file).toLowerCase()] ?? null,
        file_size_bytes: bytes.length,
      })

      if (insertError) {
        console.error(`Failed to record ${file}:`, insertError.message)
      } else {
        console.log(`Imported: ${folder}/${file}`)
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
