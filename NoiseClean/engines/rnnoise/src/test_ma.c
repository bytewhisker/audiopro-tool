#define MINIAUDIO_IMPLEMENTATION
#define MA_NO_DEVICE_IO
#define MA_NO_THREADING
#include "miniaudio.h"
#include <stdio.h>

int main() {
    printf("miniaudio version: %s\n", MA_VERSION_STRING);
    return 0;
}
