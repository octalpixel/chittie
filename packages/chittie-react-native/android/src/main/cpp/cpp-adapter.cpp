#include <jni.h>
#include "ChittieReactNativeOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::chittie::initialize(vm);
}
