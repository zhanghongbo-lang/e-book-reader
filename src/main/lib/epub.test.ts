import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  decodeEntities,
  findOpfPath,
  htmlToText,
  parseEpub,
  parseNcx,
  parseNavToc,
  parseOpf,
  resolveAnchorOffset,
  resolveRelative,
  splitFragment
} from './epub'

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
  it('解析标题、manifest、spine 阅读顺序与 ncx/nav 路径', () => {
    const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>测试书名</dc:title>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`
    const info = parseOpf(opf)
    expect(info.title).toBe('测试书名')
    expect(info.spine).toEqual(['c1', 'c2'])
    expect(info.manifest.get('c1')).toBe('chapter1.xhtml')
    expect(info.manifest.get('c2')).toBe('chapter2.xhtml')
    expect(info.ncxHref).toBe('toc.ncx')
    expect(info.navHref).toBeNull()
  })

  it('识别 EPUB3 的 nav 文档', () => {
    const opf = `<package>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine/>
</package>`
    expect(parseOpf(opf).navHref).toBe('nav.xhtml')
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

describe('splitFragment', () => {
  it('拆出路径与锚点', () => {
    expect(splitFragment('chapter1.xhtml#part1')).toEqual({
      path: 'chapter1.xhtml',
      fragment: 'part1'
    })
    expect(splitFragment('chapter1.xhtml')).toEqual({ path: 'chapter1.xhtml', fragment: '' })
  })

  it('对锚点做 URL 解码', () => {
    expect(splitFragment('a.xhtml#part%201')).toEqual({ path: 'a.xhtml', fragment: 'part 1' })
  })
})

describe('resolveAnchorOffset', () => {
  it('定位到 id 锚点所在字符偏移', () => {
    const html =
      '<html><body><p>第一段。</p><h2 id="ch2">第二章 标题</h2><p>第二段。</p></body></html>'
    expect(resolveAnchorOffset(html, 'ch2')).toBe(5)
  })

  it('支持 <a name> 锚点', () => {
    const html = '<html><body><p>甲</p><a name="x"></a><p>乙</p></body></html>'
    expect(resolveAnchorOffset(html, 'x')).toBe(2)
  })

  it('找不到返回 null', () => {
    expect(resolveAnchorOffset('<p>正文</p>', 'nope')).toBeNull()
  })
})

describe('parseNcx', () => {
  it('展平嵌套 navPoint 并保持文档顺序', () => {
    const ncx = `<ncx>
  <navMap>
    <navPoint id="n1" playOrder="1">
      <navLabel><text>第一卷</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="n2" playOrder="2">
      <navLabel><text>第二卷</text></navLabel>
      <content src="chapter2.xhtml"/>
      <navPoint id="n3" playOrder="3">
        <navLabel><text>抗日战争时期（上）</text></navLabel>
        <content src="chapter2.xhtml#part"/>
      </navPoint>
    </navPoint>
  </navMap>
</ncx>`
    expect(parseNcx(ncx)).toEqual([
      { label: '第一卷', href: 'chapter1.xhtml' },
      { label: '第二卷', href: 'chapter2.xhtml' },
      { label: '抗日战争时期（上）', href: 'chapter2.xhtml#part' }
    ])
  })

  it('空 navMap 返回空数组', () => {
    expect(parseNcx('<ncx><navMap/></ncx>')).toEqual([])
  })
})

describe('parseNavToc', () => {
  it('提取 toc nav 里的链接（含嵌套）', () => {
    const nav = `<html><body>
<nav epub:type="toc">
  <ol>
    <li><a href="chapter1.xhtml">第一卷</a></li>
    <li><a href="chapter2.xhtml">第二卷</a>
      <ol>
        <li><a href="chapter2.xhtml#p1">抗日战争时期（上）</a></li>
      </ol>
    </li>
  </ol>
</nav>
<nav epub:type="landmarks"><ol><li><a href="cover.xhtml">封面</a></li></ol></nav>
</body></html>`
    expect(parseNavToc(nav)).toEqual([
      { label: '第一卷', href: 'chapter1.xhtml' },
      { label: '第二卷', href: 'chapter2.xhtml' },
      { label: '抗日战争时期（上）', href: 'chapter2.xhtml#p1' }
    ])
  })
})

describe('parseEpub', () => {
  const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

  const chapter1 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title></head>
<body><h1>第一章 开始</h1><p>你好，世界。</p></body>
</html>`

  const chapter2 = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第二章</title></head>
<body><h1>第二章 内容。</h1><p>第二段。</p></body>
</html>`

  function buildOpf(tocAttr: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>测试书名</dc:title>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine${tocAttr ? ` toc="${tocAttr}"` : ''}>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`
  }

  const ncx = `<?xml version="1.0"?>
<ncx version="2005-1">
  <navMap>
    <navPoint id="n1" playOrder="1">
      <navLabel><text>第一卷</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="n2" playOrder="2">
      <navLabel><text>第二卷</text></navLabel>
      <content src="chapter2.xhtml"/>
      <navPoint id="n3" playOrder="3">
        <navLabel><text>抗日战争时期（上）</text></navLabel>
        <content src="chapter2.xhtml#part"/>
      </navPoint>
    </navPoint>
  </navMap>
</ncx>`

  async function buildEpub(withNcx: boolean): Promise<Buffer> {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', containerXml)
    zip.file('OEBPS/content.opf', buildOpf(withNcx ? 'ncx' : ''))
    if (withNcx) zip.file('OEBPS/toc.ncx', ncx)
    zip.file('OEBPS/chapter1.xhtml', chapter1)
    zip.file('OEBPS/chapter2.xhtml', chapter2)
    return zip.generateAsync({ type: 'nodebuffer' })
  }

  it('按 spine 顺序拼接文本，并使用内置 NCX 目录', async () => {
    const parsed = await parseEpub(await buildEpub(true))
    expect(parsed.title).toBe('测试书名')
    expect(parsed.content).toBe('第一章 开始\n你好，世界。\n第二章 内容。\n第二段。')
    expect(parsed.chapters).toEqual([
      { title: '第一卷', start: 0 },
      { title: '第二卷', start: 14 },
      { title: '抗日战争时期（上）', start: 14 }
    ])
  })

  it('无内置目录时回退到正则识别章节', async () => {
    const parsed = await parseEpub(await buildEpub(false))
    expect(parsed.chapters.map((c) => c.title)).toEqual(['第一章 开始', '第二章 内容。'])
  })

  it('锚点指向同一文件内的精确偏移（单文件 EPUB）', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', containerXml)
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试</dc:title></metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="book" href="book.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="book"/>
  </spine>
</package>`
    )
    zip.file(
      'OEBPS/toc.ncx',
      `<ncx><navMap>
  <navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="book.xhtml#ch1"/></navPoint>
  <navPoint id="n2" playOrder="2"><navLabel><text>第二章</text></navLabel><content src="book.xhtml#ch2"/></navPoint>
</navMap></ncx>`
    )
    zip.file(
      'OEBPS/book.xhtml',
      '<html><head><title>x</title></head><body><h2 id="ch1">第一章 标题</h2><p>第一段。</p><h2 id="ch2">第二章 标题</h2><p>第二段。</p></body></html>'
    )
    const parsed = await parseEpub(await zip.generateAsync({ type: 'nodebuffer' }))
    expect(parsed.chapters.map((c) => c.title)).toEqual(['第一章', '第二章'])
    expect(parsed.chapters.map((c) => c.start)).toEqual([0, 12])
  })

  it('缺 container.xml 时抛错', async () => {
    const zip = new JSZip()
    zip.file('foo.txt', 'x')
    await expect(parseEpub(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow(
      'container.xml'
    )
  })
})
