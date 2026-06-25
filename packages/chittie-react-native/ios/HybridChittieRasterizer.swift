import Foundation
import NitroModules
import UIKit

// Implements the nitrogen-generated HybridChittieRasterizerSpec.
// Shapes one line of text with UIKit/CoreText (complex-script shaping + bidi for
// free) into an RGBA bitmap sized to the TEXT (so chittie's ESC alignment can
// center the image), with width/height padded to multiples of 8.
class HybridChittieRasterizer: HybridChittieRasterizerSpec {
  func rasterize(text: String, fontSize: Double, maxWidth: Double, bold: Bool) throws -> RasterBitmap {
    let font = bold
      ? UIFont.boldSystemFont(ofSize: CGFloat(fontSize))
      : UIFont.systemFont(ofSize: CGFloat(fontSize))
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.black]
    let attr = NSAttributedString(string: text, attributes: attrs)

    let maxW = CGFloat(max(8, maxWidth))
    let opts: NSStringDrawingOptions = [.usesLineFragmentOrigin, .usesFontLeading]
    let bounds = attr.boundingRect(
      with: CGSize(width: maxW, height: .greatestFiniteMagnitude), options: opts, context: nil)

    func pad8(_ v: Int) -> Int { (v + 7) & ~7 }
    let w = max(8, pad8(Int(ceil(bounds.width)) + 2))
    let h = max(8, pad8(Int(ceil(bounds.height)) + 2))

    let bytesPerRow = w * 4
    var pixels = [UInt8](repeating: 255, count: w * h * 4) // white, opaque
    guard
      let ctx = CGContext(
        data: &pixels, width: w, height: h, bitsPerComponent: 8, bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else {
      throw NSError(domain: "chittie", code: 1, userInfo: [NSLocalizedDescriptionKey: "CGContext failed"])
    }

    // UIKit draws top-left origin; flip the CG context to match.
    UIGraphicsPushContext(ctx)
    ctx.translateBy(x: 0, y: CGFloat(h))
    ctx.scaleBy(x: 1, y: -1)
    attr.draw(with: CGRect(x: 1, y: 1, width: CGFloat(w) - 2, height: CGFloat(h) - 2),
              options: opts, context: nil)
    UIGraphicsPopContext()

    let buffer = ArrayBuffer.copy(data: Data(pixels))
    return RasterBitmap(data: buffer, width: Double(w), height: Double(h))
  }
}
