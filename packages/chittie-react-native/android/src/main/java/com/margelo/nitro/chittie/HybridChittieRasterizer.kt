package com.margelo.nitro.chittie

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.margelo.nitro.core.ArrayBuffer
import java.nio.ByteBuffer
import kotlin.math.ceil

// Implements the nitrogen-generated HybridChittieRasterizerSpec.
// StaticLayout shapes complex scripts (Sinhala/Tamil joining), bidi (Arabic) and
// wrapping. We size the bitmap to the TEXT width (so chittie's ESC alignment can
// center the image) and pad width/height to multiples of 8.
class HybridChittieRasterizer : HybridChittieRasterizerSpec() {
  override fun rasterize(text: String, fontSize: Double, maxWidth: Double, bold: Boolean): RasterBitmap {
    val paint = TextPaint().apply {
      isAntiAlias = true
      color = Color.BLACK
      textSize = fontSize.toFloat()
      typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }
    val maxW = maxWidth.toInt().coerceAtLeast(8)

    val layout = StaticLayout.Builder
      .obtain(text, 0, text.length, paint, maxW)
      .setAlignment(Layout.Alignment.ALIGN_NORMAL)
      .setIncludePad(false)
      .build()

    fun pad8(v: Int) = (v + 7) and 7.inv()
    var used = 0f
    for (i in 0 until layout.lineCount) used = maxOf(used, layout.getLineWidth(i))
    val w = pad8(ceil(used.toDouble()).toInt().coerceIn(8, maxW))
    val h = pad8(layout.height.coerceAtLeast(8))

    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    Canvas(bmp).apply {
      drawColor(Color.WHITE)
      layout.draw(this)
    }

    val bb = ByteBuffer.allocateDirect(w * h * 4)
    bmp.copyPixelsToBuffer(bb)
    bb.rewind()
    bmp.recycle()

    return RasterBitmap(data = ArrayBuffer.copy(bb), width = w.toDouble(), height = h.toDouble())
  }
}
