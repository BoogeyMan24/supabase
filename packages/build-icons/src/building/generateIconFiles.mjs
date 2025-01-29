import fs from 'fs'
import path from 'path'
import prettier from 'prettier'
import { readSvg, toPascalCase } from '../utils/helpers.mjs'

export default async ({
  iconNodes,
  outputDirectory,
  template,
  showLog = true,
  iconFileExtension = '.js',
  pretty = true,
  iconsDir,

  // TO DO -- START
  //
  // move this to ./build-registry in design-system
  // with all the other build scripts
  // @mildtomato
  registryDir,
  // TO DO -- END

  iconMetaData,
}) => {
  const icons = Object.keys(iconNodes)
  const iconsDistDirectory = path.join(outputDirectory, `icons`)

  if (!fs.existsSync(iconsDistDirectory)) {
    fs.mkdirSync(iconsDistDirectory)
  }

  // TO DO -- START
  //
  // move this to ./build-registry in design-system
  // with all the other build scripts
  // @mildtomato
  let registryIndex = `// @ts-nocheck
// This file is autogenerated by icons-build/src/building/generateIconFiles.mjs
// Do not edit this file directly.
import * as React from "react"

export const Index: Record<string, any> = [`
  // TO DO -- END

  const registryOutput = path.join(registryDir, 'index.tsx')

  for (const [i, iconName] of icons.entries()) {
    const location = path.join(iconsDistDirectory, `${iconName}${iconFileExtension}`)

    const componentName = toPascalCase(iconName)

    let { children } = iconNodes[iconName]
    children = children.map(({ name, attributes }) => [name, attributes])

    const getSvg = () => readSvg(`${iconName}.svg`, iconsDir)
    // const { deprecated = false } = iconMetaData[iconName]
    const deprecated = false

    const elementTemplate = template({ componentName, iconName, children, getSvg, deprecated })
    const output = pretty
      ? await prettier.format(elementTemplate, {
          singleQuote: true,
          trailingComma: 'all',
          printWidth: 100,
          parser: 'babel',
        })
      : elementTemplate

    const rawSvg = JSON.stringify(readSvg(`${iconName}.svg`, iconsDir))

    // TO DO -- START
    //
    // move this to ./build-registry in design-system
    // with all the other build scripts
    // @mildtomato
    registryIndex += `\n{`
    registryIndex += `
  name: "${iconName}",
  componentName: "${componentName}",
  deprecated: ${deprecated},
  raw: ${JSON.stringify(output)},
  component: React.lazy(() => import('icons/src/icons/${iconName}')),
  import: "import { ${componentName} } from 'icons'",
  svg: ${JSON.stringify(readSvg(`${iconName}.svg`, iconsDir))},
  jsx: ${JSON.stringify(`import { ${componentName} } from "icons"
  <${componentName}/>
  `)}`
    if (i !== icons.length - 1) {
      registryIndex += `\n},`
    }
    // TO DO -- END

    console.log('Created ' + componentName)
    await fs.promises.writeFile(location, output, 'utf-8')
  }

  // TO DO -- START
  //
  // move this to ./build-registry in design-system
  // with all the other build scripts
  // @mildtomato
  async function writeRegistry() {
    console.log(registryIndex)

    registryIndex += `\n}`
    // close index
    registryIndex += `\n]`

    await fs.promises.writeFile(registryOutput, registryIndex, 'utf-8')
    console.log('Successfully created registry at', registryOutput)
  }
  // TO DO -- END

  await writeRegistry()
    .then(() => {
      if (showLog) {
        console.log('Successfully built', icons.length, 'icons.')
      }
    })
    .catch((error) => {
      throw new Error(`Something went wrong generating icon files,\n ${error}`)
    })
}
