import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { decodeEntities, findOpfPath, htmlToText, parseEpub, parseOpf, resolveRelative } from './epub'

describe('decodeEntities', () => {
  it('解码命名实体', () => {
    expect(decodeEntities('a&amp;b &lt;c&gt; &quot;d&quot; &apos;e&apos;')).toBe(
      'a&b <c> "d" \'e\''
    )
  })

  it('解码数字与十六进制实体', () => {
    expect(decodeEntities('&#20013;&#25991;&#x4E2D;&#x6587;')).toBe('中文中文')
  })

  it('非法码点返回空串而非抛异常', () => {
    expect(decodeEntities('&#x110000;x')).toBe('x')
  })

  it('nbsp 转为空格', () => {
    expect(decodeEntities('a&nbsp;b')).toBe('a b')
  })
})

describe('htmlToText', () => {
  it('去除 head/style/script 并提取段落文本', () => {
    const html =
      '<html><head><title>标题</title><style>p{color:red}</style><script>var a=1;</script></head>' +
      '<body><h1>第一章</h1><p>第一段。</p><p>第二段。</p></body></html>'
    expect(htmlToText(html)).toBe('第一章\n第一段。\n第二段。')
  })

  it('br 与块级闭合标签转为换行，标签被剥离', () => {
    expect(htmlToText('<div><p>甲</p><p>乙<br/>丙</p></div>')).toBe('甲\n乙\n丙')
  })

  it('多行空行被折叠，首尾空白被去除', () => {
    expect(htmlToText('<p>甲</p>\n\n\n<p>乙</p>')).toBe('甲\n乙')
  })

  it('忽略 HTML 注释', () => {
    expect(htmlToText('<!-- 注释 --><p>正文</p>')).toBe('正文')
  })
})

describe('findOpfPath', () => {
  it('从 container.xml 定位 OPF', () => {
    const xml =
      '<?xml version="1.0"?><container><rootfiles>' +
      '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
      '</rootfiles></container>'
    expect(findOpfPath(xml)).toBe('OEBPS/content.opf')
  })

  it('无 rootfile 返回 null', () => {
    expect(findOpfPath('<container/>')).toBeNull()
  })
})

describe('parseOpf', () => {
  it('解析标题、manifest 与 spine 阅读顺序', () => {
    const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>测试书名</dc:title>
  </metadata>
  <manifest>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`
    const info = parseOpf(opf)
    expect(info.title).toBe('测试书名')
    expect(info.spine).toEqual(['c1', 'c2'])
    expect(info.manifest.get('c1')).toBe('chapter1.xhtml')
    expect(info.manifest.get('c2')).toBe('chapter2.xhtml')
  })

  it('缺标题时返回 null', () => {
    expect(parseOpf('<package><spine/></package>').title).toBeNull()
  })
})

describe('resolveRelative', () => {
  it('拼接相对路径', () => {
    expect(resolveRelative('OEBPS', 'chapter1.xhtml')).toBe('OEBPS/chapter1.xhtml')
  })

  it('处理 ../ 与 URL 编码', () => {
    expect(resolveRelative('OEBPS/text', '../chapter1.xhtml')).toBe('OEBPS/chapter1.xhtml')
    expect(resolveRelative('OEBPS', 'a%20b.xhtml')).toBe('OEBPS/a b.xhtml')
  })

  it('去掉锚点片段', () => {
    expect(resolveRelative('OEBPS', 'chapter1.xhtml#part')).toBe('OEBPS/chapter1.xhtml')
  })

  it('空基目录时不加斜杠', () => {
    expect(resolveRelative('', 'content.opf')).toBe('content.opf')
  })
})

describe('parseEpub', () => {
  async function buildEpub(): Promise<Buffer> {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)
    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>测试书名</dc:title>
  </metadata>
  <manifest>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`)
    zip.file('OEBPS/chapter1.xhtml', `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title><style>p{color:red}</style></head>
<body><h1>第一章 开始</h1><p>你好，世界。</p><p>这是第一段。</p></body>
</html>`)
    zip.file('OEBPS/chapter2.xhtml', `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第二章</title></head>
<body><p>第二章 内容。</p><p>第二段。<br/>换行。</p></body>
</html>`)
    return zip.generateAsync({ type: 'nodebuffer' })
  }

  it('按 spine 顺序拼接文本并识别章节', async () => {
    const parsed = await parseEpub(await buildEpub())
    expect(parsed.title).toBe('测试书名')
    expect(parsed.content).toBe(
      '第一章 开始\n你好，世界。\n这是第一段。\n第二章 内容。\n第二段。\n换行。'
    )
    expect(parsed.chapters.map((c) => c.title)).toEqual(['第一章 开始', '第二章 内容。'])
  })

  it('缺 container.xml 时抛错', async () => {
    const zip = new JSZip()
    zip.file('foo.txt', 'x')
    await expect(parseEpub(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow(
      'container.xml'
    )
  })
})
