require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ChittieReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/octalpixel/chittie.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking / registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # C++ objects (if any)
    "cpp/**/*.{hpp,cpp}",
  ]

  # nitrogen-generated autolinking (produced by `nitro-codegen`).
  load 'nitrogen/generated/ios/ChittieReactNative+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
