import './style.css'
import QRCode from 'qrcode'

const urlInput = document.querySelector<HTMLInputElement>('#url-input')!
const qrCanvas = document.querySelector<HTMLCanvasElement>('#qr-canvas')!
const downloadPngBtn =
  document.querySelector<HTMLButtonElement>('#download-btn')!
const downloadSvgBtn =
  document.querySelector<HTMLButtonElement>('#download-svg-btn')!
const previewSection = document.querySelector<HTMLDivElement>('.preview-section')!
const colorPicker = document.querySelector<HTMLInputElement>('#color-picker')!

const QR_MARGIN = 1
const QR_ECC = 'M'
const DEFAULT_URL = 'https://qrblink.net'
let currentUrl = ''
let qrColor = '#000000'

function setCanvasSize() {
  const size = Math.floor(previewSection.clientWidth || 300)
  if (size > 0) {
    qrCanvas.width = size
    qrCanvas.height = size
  }
  return size
}

async function generateQRCode(text: string) {
  try {
    if (!text) {
      await renderPlaceholder()
      toggleDownloads(false)
      return
    }

    await renderQr(text)
    currentUrl = text
    toggleDownloads(false)
  } catch (err) {
    console.error('Error generating QR code:', err)
  }
}

urlInput.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement
  generateQRCode(target.value)
})

window.addEventListener('resize', () => {
  setCanvasSize()
  if (currentUrl) {
    generateQRCode(currentUrl)
  } else {
    renderPlaceholder()
  }
})

downloadPngBtn.addEventListener('click', async () => {
  if (!currentUrl) return

  try {
    const dataUrl = await QRCode.toDataURL(currentUrl, {
      width: 1024,
      margin: QR_MARGIN,
      color: getColors(),
      errorCorrectionLevel: QR_ECC
    })

    const link = document.createElement('a')
    link.download = 'qrcode.png'
    link.href = dataUrl
    link.click()
  } catch (err) {
    console.error('Error downloading QR code:', err)
  }
})

downloadSvgBtn.addEventListener('click', async () => {
  if (!currentUrl) return

  try {
    const svgString = await QRCode.toString(currentUrl, {
      type: 'svg',
      margin: QR_MARGIN,
      color: getColors(),
      errorCorrectionLevel: QR_ECC,
      scale: 1
    })

    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.download = 'qrcode.svg'
    link.href = url
    link.click()

    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error downloading QR code as SVG:', err)
  }
})

downloadPngBtn.disabled = true
downloadSvgBtn.disabled = true
setCanvasSize()
renderPlaceholder()

colorPicker.addEventListener('input', () => {
  qrColor = colorPicker.value || '#000000'
  if (currentUrl) {
    generateQRCode(currentUrl)
  } else {
    renderPlaceholder()
  }
})

async function renderQr(text: string) {
  const size = setCanvasSize()
  await QRCode.toCanvas(qrCanvas, text, {
    width: size,
    margin: QR_MARGIN,
    color: getColors(),
    errorCorrectionLevel: QR_ECC
  })
}

async function renderPlaceholder() {
  await renderQr(DEFAULT_URL)
  currentUrl = DEFAULT_URL
  toggleDownloads(false)
}

function toggleDownloads(disabled: boolean) {
  downloadPngBtn.disabled = disabled
  downloadSvgBtn.disabled = disabled
}

function getColors() {
  return { dark: qrColor, light: '#FFFFFF' }
}
