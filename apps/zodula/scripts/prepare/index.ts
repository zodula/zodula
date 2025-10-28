import { TypeGenerator } from '@/zodula/server/type-generator/type-generator'
import { prepareApp, prepareIndexHtml, prepareTsxPage } from './tsxPage'
import path from 'path'

export default async function prepareScript() {
  // prepare root files
  // bunfig.toml
  await Bun.write(path.join(process.cwd(), "bunfig.toml"), `
  [serve.static]
  plugins = ["bun-plugin-tailwind"]
  `)

  await TypeGenerator.generate()
  await prepareApp()
  await prepareIndexHtml()
}