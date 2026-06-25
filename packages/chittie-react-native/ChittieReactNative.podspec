require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Standard Nitro-module podspec. The nitrogen/ files are produced by `nitro-codegen`;
# validated by the iOS device build. See https://nitro.margelo.com/docs/nitrogen
Pod::Spec.new do |s|
  s.name         = "ChittieReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/octalpixel/chittie"
  s.license      = package["license"]
  s.authors      = "angadie"
  s.platforms    = { :ios => 13.4 }
  s.source       = { :git => "https://github.com/octalpixel/chittie.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift}",
    "nitrogen/generated/ios/**/*.{swift,hpp,cpp}",
  ]

  load 'nitrogen/generated/ios/ChittieReactNative+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
