import './style.css'
import QRCodeStyling, {
  type CornerDotType,
  type CornerSquareType,
  type DotType
} from 'qr-code-styling'

const urlInput = document.querySelector<HTMLInputElement>('#url-input')!
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

const QR_MARGIN = 1
const QR_ECC = 'M'
const DEFAULT_URL = 'https://marqr.net'
let currentUrl = DEFAULT_URL
let qrColor = '#000000'
type StyleKey = 'rounded' | 'dots' | 'classy' | 'square'
let currentStyle: StyleKey = 'square'

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
  if (!styleSection.contains(e.target as Node)) {
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

applyStyle(currentStyle, { rerender: false })
updateColorPickerVisual(qrColor)
handleInput('')
closeStyleMenu()

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
