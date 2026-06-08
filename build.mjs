import { build } from 'esbuild'
import { readdirSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execSync } from 'node:child_process'

const SRC_DIRS = ['api', 'processors']
const DIST_DIR = 'dist'
const FIXED_TIMESTAMP = '202401010000.00'

const getEntryPoints = (dir) => {
    const fullPath = join('src', dir)
    return readdirSync(fullPath)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
        .map((f) => ({
            name: basename(f, '.ts'),
            path: join(fullPath, f),
            group: dir,
        }))
}

const zipFile = (jsFileName, outDir) => {
    execSync(
        `cd ${outDir} && touch -a -m -t ${FIXED_TIMESTAMP} ${jsFileName} && zip -rX ${jsFileName.replace('.js', '.zip')} ${jsFileName}`,
    )
}

const main = async () => {
    const entryPoints = SRC_DIRS.flatMap(getEntryPoints)

    console.log(`Building ${entryPoints.length} Lambda handlers...`)

    for (const entry of entryPoints) {
        const outDir = join(DIST_DIR, entry.group)
        mkdirSync(outDir, { recursive: true })

        const outFile = join(outDir, `${entry.name}.js`)

        await build({
            entryPoints: [entry.path],
            bundle: true,
            platform: 'node',
            target: 'node22',
            format: 'cjs',
            outfile: outFile,
            minify: true,
            sourcemap: false,
            external: [
                '@aws-sdk/*',
            ],
        })

        zipFile(`${entry.name}.js`, outDir)
        console.log(`  ✓ ${entry.group}/${entry.name}`)
    }

    console.log('Build complete!')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
