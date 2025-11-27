import './style.css'
import QRCodeStyling, {
  type CornerDotType,
  type CornerSquareType,
  type DotType
} from 'qr-code-styling'

const urlInput = document.querySelector<HTMLInputElement>('#url-input')!
const redirectInputCreate =
  document.querySelector<HTMLInputElement>('#redirect-input-create')!
const redirectInputEdit =
  document.querySelector<HTMLInputElement>('#redirect-input-edit')!
const currentLink = document.querySelector<HTMLDivElement>('#current-link')!
const currentShortLink =
  document.querySelector<HTMLAnchorElement>('#current-short')!
const qrTarget = document.querySelector<HTMLDivElement>('#qr-target')!
const downloadPngBtn =
  document.querySelector<HTMLButtonElement>('#download-btn')!
const downloadSvgBtn =
  document.querySelector<HTMLButtonElement>('#download-svg-btn')!
const colorPicker = document.querySelector<HTMLInputElement>('#color-picker')!
const colorPickerWrapper =
  document.querySelector<HTMLLabelElement>('.color-picker')!
const styleToggle = document.querySelector<HTMLButtonElement>('#style-toggle')!
const styleMenu = document.querySelector<HTMLDivElement>('#style-menu')!
const styleLabel = document.querySelector<HTMLSpanElement>('#style-label')!
const styleSection = document.querySelector<HTMLElement>('.style-section')!
const popoverStatusCreate =
  document.querySelector<HTMLParagraphElement>('#popover-status-create')!
const popoverStatusEdit =
  document.querySelector<HTMLParagraphElement>('#popover-status-edit')!
const shortUrlLink = document.querySelector<HTMLAnchorElement>('#short-url')!
const ownerUrlLink = document.querySelector<HTMLAnchorElement>('#owner-url')!
const copyShortBtn =
  document.querySelector<HTMLButtonElement>('#copy-short-url')!
const copyOwnerBtn =
  document.querySelector<HTMLButtonElement>('#copy-owner-url')!
const clicksBadge = document.querySelector<HTMLSpanElement>('#redirect-clicks')!
const ownerOpenBtn = document.querySelector<HTMLButtonElement>('#owner-toggle')!
const ownerCloseBtn = document.querySelector<HTMLButtonElement>('#owner-close')!
const ownerPopover = document.querySelector<HTMLDivElement>('#owner-popover')!
const ownerBackdrop = document.querySelector<HTMLDivElement>('#owner-backdrop')!
const createLinkBtn = document.querySelector<HTMLButtonElement>('#link-create')!
const updateLinkBtn = document.querySelector<HTMLButtonElement>('#link-update')!
const newLinkBtn = document.querySelector<HTMLButtonElement>('#new-link')!
const createView = document.querySelector<HTMLDivElement>('#redirect-create-view')!
const editView = document.querySelector<HTMLDivElement>('#redirect-edit-view')!

const QR_MARGIN = 1
const QR_ECC = 'M'
const DEFAULT_URL = 'https://marqr.net'
let currentUrl = DEFAULT_URL
let qrColor = '#000000'
type StyleKey = 'rounded' | 'dots' | 'classy' | 'square'
let currentStyle: StyleKey = 'square'
type RedirectRecord = {
  slug: string
  url: string
  shortUrl: string
  secret: string
  manageUrl: string
  clicks?: number
  createdAt?: number
}
let activeRedirect: RedirectRecord | null = null
let displayedShortUrl: string | null = null

const STYLE_MAP: Record<
  StyleKey,
  {
    dots: DotType
    cornersSquare: CornerSquareType
    cornersDot: CornerDotType
    label: string
  }
> = {
  rounded: {
    dots: 'rounded',
    cornersSquare: 'extra-rounded',
    cornersDot: 'dot',
    label: 'Rounded'
  },
  dots: {
    dots: 'dots',
    cornersSquare: 'dot',
    cornersDot: 'dot',
    label: 'Dots'
  },
  classy: {
    dots: 'classy',
    cornersSquare: 'classy-rounded',
    cornersDot: 'classy',
    label: 'Classy'
  },
  square: {
    dots: 'square',
    cornersSquare: 'square',
    cornersDot: 'square',
    label: 'Square'
  }
}

const qrCode = new QRCodeStyling({
  width: 1024,
  height: 1024,
  type: 'svg',
  data: DEFAULT_URL,
  margin: QR_MARGIN,
  qrOptions: { errorCorrectionLevel: QR_ECC },
  dotsOptions: { color: qrColor, type: STYLE_MAP[currentStyle].dots },
  cornersSquareOptions: {
    color: qrColor,
    type: STYLE_MAP[currentStyle].cornersSquare
  },
  cornersDotOptions: { color: qrColor, type: STYLE_MAP[currentStyle].cornersDot },
  backgroundOptions: { color: '#FFFFFF' }
})

qrCode.append(qrTarget)

function renderQr(data: string) {
  qrCode.update({
    type: 'svg',
    data,
    dotsOptions: { color: qrColor, type: STYLE_MAP[currentStyle].dots },
    cornersSquareOptions: {
      color: qrColor,
      type: STYLE_MAP[currentStyle].cornersSquare
    },
    cornersDotOptions: { color: qrColor, type: STYLE_MAP[currentStyle].cornersDot },
    backgroundOptions: { color: '#FFFFFF' }
  })
}

function handleInput(text: string) {
  const data = text.trim() || DEFAULT_URL
  currentUrl = data
  renderQr(data)
  downloadPngBtn.disabled = false
  downloadSvgBtn.disabled = false
}

urlInput.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement
  handleInput(target.value)
  if (displayedShortUrl && target.value.trim() !== displayedShortUrl) {
    hideMainLinkDisplay()
  }
})

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleInput(urlInput.value)
  }
})


colorPicker.addEventListener('input', () => {
  qrColor = colorPicker.value || '#000000'
  updateColorPickerVisual(qrColor)
  renderQr(currentUrl)
})

styleToggle.addEventListener('click', () => {
  const isOpen = !styleMenu.hasAttribute('hidden')
  if (isOpen) {
    closeStyleMenu()
  } else {
    openStyleMenu()
  }
})

styleMenu.querySelectorAll<HTMLButtonElement>('button[data-style]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const styleKey = btn.getAttribute('data-style') as StyleKey
    applyStyle(styleKey)
    closeStyleMenu()
  })
})

document.addEventListener('click', (e) => {
  if (!styleMenu || styleMenu.hasAttribute('hidden')) return
  if (styleSection && !styleSection.contains(e.target as Node)) {
    closeStyleMenu()
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !styleMenu.hasAttribute('hidden')) {
    closeStyleMenu()
  }
})

downloadPngBtn.addEventListener('click', async () => {
  await qrCode.download({ name: 'qrcode', extension: 'png' })
})

downloadSvgBtn.addEventListener('click', async () => {
  await qrCode.download({ name: 'qrcode', extension: 'svg' })
})

copyShortBtn.addEventListener('click', () => {
  if (shortUrlLink.textContent) {
    void copyToClipboard(shortUrlLink.textContent, copyShortBtn)
  }
})

copyOwnerBtn.addEventListener('click', () => {
  if (ownerUrlLink.textContent) {
    void copyToClipboard(ownerUrlLink.textContent, copyOwnerBtn)
  }
})

ownerOpenBtn.addEventListener('click', () => {
  openOwnerPopover()
})
ownerBackdrop.addEventListener('click', closeOwnerPopover)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !ownerPopover.hasAttribute('hidden')) {
    dismissOwnerPopover()
  }
})

applyStyle(currentStyle, { rerender: false })
updateColorPickerVisual(qrColor)
handleInput('')
closeStyleMenu()
void hydrateFromUrl()

function applyStyle(style: StyleKey, opts: { rerender?: boolean } = {}) {
  currentStyle = style
  const meta = STYLE_MAP[style]
  styleLabel.textContent = meta.label
  styleToggle
    .querySelector('.style-swatch')
    ?.setAttribute('class', `style-swatch style-${style}`)
  if (opts.rerender !== false) {
    renderQr(currentUrl)
  }
}

function openStyleMenu() {
  styleMenu.removeAttribute('hidden')
  styleToggle.setAttribute('aria-expanded', 'true')
}

function closeStyleMenu() {
  styleMenu.setAttribute('hidden', '')
  styleToggle.setAttribute('aria-expanded', 'false')
}

function updateColorPickerVisual(color: string) {
  colorPickerWrapper.style.setProperty('--picker-color', color)
}

function renderCreateView(opts: { empty?: boolean } = {}) {
  createView.hidden = false
  editView.hidden = true
  newLinkBtn.hidden = true
  redirectInputCreate.value = opts.empty ? '' : urlInput.value.trim()
  setStatus(popoverStatusCreate, '')

  ownerCloseBtn.onclick = dismissOwnerPopover

  const handleCreate = async () => {
    const destination = redirectInputCreate.value.trim()
    if (!destination) {
      setStatus(popoverStatusCreate, 'Enter a destination URL to shorten', 'error')
      return
    }

    setBusy(createLinkBtn, true)
    setStatus(popoverStatusCreate, 'Creating...')

    try {
      const record = await callJson<RedirectRecord>('/api/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: destination })
      })
      setActiveRedirect(record)
      showMainLink(record)
      renderEditView(record, { isNew: true })
    } catch (error) {
      setStatus(popoverStatusCreate, humanizeError(error), 'error')
    } finally {
      setBusy(createLinkBtn, false)
    }
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleCreate()
    }
  }

  createLinkBtn.onclick = () => void handleCreate()
  redirectInputCreate.onkeydown = onKeydown
}

function renderEditView(record: RedirectRecord, opts: { isNew?: boolean } = {}) {
  createView.hidden = true
  editView.hidden = false
  newLinkBtn.hidden = false
  redirectInputEdit.value = record.url

  ownerCloseBtn.onclick = () => closeOwnerPopover()

  if (opts.isNew) {
    setStatus(popoverStatusEdit, 'Link created.', 'success')
  } else {
    setStatus(popoverStatusEdit, '')
  }

  shortUrlLink.textContent = record.shortUrl
  shortUrlLink.href = record.shortUrl
  ownerUrlLink.textContent = record.manageUrl
  ownerUrlLink.href = record.manageUrl
  clicksBadge.textContent = typeof record.clicks === 'number' ? `${record.clicks}` : '—'

  updateLinkBtn.disabled = true

  const syncUpdateButton = () => {
    const hasChanged = redirectInputEdit.value.trim() !== record.url
    updateLinkBtn.disabled = !hasChanged
  }

  const handleUpdate = async () => {
    const destination = redirectInputEdit.value.trim()
    if (!destination) {
      setStatus(popoverStatusEdit, 'Destination is required', 'error')
      return
    }

    setBusy(updateLinkBtn, true)
    setStatus(popoverStatusEdit, 'Saving...')

    try {
      const updated = await callJson<RedirectRecord>(`/api/url/${record.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: destination, secret: record.secret })
      })
      setActiveRedirect(updated)
      showMainLink(updated)
      renderEditView(updated)
      setStatus(popoverStatusEdit, 'Saved.', 'success')
    } catch (error) {
      setBusy(updateLinkBtn, false)
      setStatus(popoverStatusEdit, humanizeError(error), 'error')
    }
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !updateLinkBtn.disabled) {
      e.preventDefault()
      void handleUpdate()
    }
  }

  updateLinkBtn.onclick = () => void handleUpdate()
  newLinkBtn.onclick = () => renderCreateView({ empty: true })
  redirectInputEdit.oninput = syncUpdateButton
  redirectInputEdit.onkeydown = onKeydown
}

async function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const slug = params.get('slug')
  const secret = params.get('secret') ?? params.get('token') ?? params.get('ownerToken') ?? params.get('adminToken')

  if (slug && secret) {
    try {
      const record = await fetchRedirect(slug, secret)
      setActiveRedirect(record)
      urlInput.value = record.shortUrl
      displayedShortUrl = record.shortUrl
      handleInput(record.shortUrl)
      showMainLink(record)
    } catch (error) {
      console.error('Could not load owner link', error)
    }
  }
}

async function fetchRedirect(slug: string, secret: string) {
  return callJson<RedirectRecord>(
    `/api/url/${encodeURIComponent(slug)}?secret=${encodeURIComponent(secret)}`
  )
}

function setActiveRedirect(record: RedirectRecord) {
  activeRedirect = record

  const params = new URLSearchParams(window.location.search)
  params.set('slug', record.slug)
  params.set('secret', record.secret)
  const newUrl = `${window.location.pathname}?${params.toString()}`
  window.history.replaceState({}, '', newUrl)

  urlInput.value = record.shortUrl
  displayedShortUrl = record.shortUrl
  handleInput(record.shortUrl)
}

async function callJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }

  return (await res.json()) as T
}

function setBusy(button: HTMLButtonElement, isBusy: boolean) {
  button.disabled = isBusy
  button.dataset.loading = isBusy ? 'true' : 'false'
}

function setStatus(el: HTMLElement, message: string, variant: 'info' | 'error' | 'success' = 'info') {
  el.textContent = message
  el.dataset.variant = variant
}

async function copyToClipboard(text: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text)
    button.dataset.tooltip = 'Copied!'
    window.setTimeout(() => {
      button.dataset.tooltip = ''
    }, 1200)
  } catch (error) {
    setStatus(popoverStatusEdit, 'Clipboard is blocked in this browser', 'error')
  }
}

function humanizeError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Try again.'
}

function openOwnerPopover() {
  ownerPopover.removeAttribute('hidden')
  ownerBackdrop.removeAttribute('hidden')
  ownerOpenBtn.setAttribute('aria-expanded', 'true')
  if (activeRedirect) {
    renderEditView(activeRedirect)
  } else {
    renderCreateView()
  }
}

function closeOwnerPopover() {
  ownerPopover.setAttribute('hidden', '')
  ownerBackdrop.setAttribute('hidden', '')
  ownerOpenBtn.setAttribute('aria-expanded', 'false')
}

function dismissOwnerPopover() {
  if (!createView.hidden && activeRedirect) {
    renderEditView(activeRedirect)
  } else {
    closeOwnerPopover()
  }
}

function showMainLink(record: RedirectRecord) {
  displayedShortUrl = record.shortUrl
  currentShortLink.textContent = record.url
  currentShortLink.href = record.url
  currentLink.hidden = false
}

function hideMainLinkDisplay() {
  displayedShortUrl = null
  currentLink.hidden = true
  currentShortLink.textContent = '—'
  currentShortLink.removeAttribute('href')
}

