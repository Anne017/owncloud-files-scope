# Put the ini, image, and js files in the build directory next
# to the scope .so file so test tools can find them easily.
intltool_merge_translations(
  "data/owncloud-files.ini.in"
  "${CMAKE_CURRENT_BINARY_DIR}/${SCOPE_NAME}.ini"
  ALL UTF8
)
intltool_merge_translations(
  "data/owncloud-files-settings.ini.in"
  "${CMAKE_CURRENT_BINARY_DIR}/${SCOPE_NAME}-settings.ini"
  ALL UTF8
)

configure_file(
  "data/icon.png"
  "${CMAKE_CURRENT_BINARY_DIR}/icon.png"
  @ONLY COPYONLY
)
configure_file(
  "data/logo.png"
  "${CMAKE_CURRENT_BINARY_DIR}/logo.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_text.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_text.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_doc.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_doc.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_zip.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_zip.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_sound.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_sound.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_code.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_code.png"
  @ONLY COPYONLY
)
configure_file(
  "data/error.svg"
  "${CMAKE_CURRENT_BINARY_DIR}/error.svg"
  @ONLY COPYONLY
)
configure_file(
  "data/file.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file.png"
  @ONLY COPYONLY
)
configure_file(
  "data/folder.png"
  "${CMAKE_CURRENT_BINARY_DIR}/folder.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_image.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_image.png"
  @ONLY COPYONLY
)
configure_file(
  "data/parent.png"
  "${CMAKE_CURRENT_BINARY_DIR}/parent.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_pdf.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_pdf.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_movie.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_movie.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_ppt.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_ppt.png"
  @ONLY COPYONLY
)
configure_file(
  "data/file_xls.png"
  "${CMAKE_CURRENT_BINARY_DIR}/file_xls.png"
  @ONLY COPYONLY
)

configure_file(
  "owncloud-files.js"
  "${CMAKE_CURRENT_BINARY_DIR}/${SCOPE_NAME}.js"
  @ONLY COPYONLY
)
configure_file(
  "filetypes.js"
  "${CMAKE_CURRENT_BINARY_DIR}/filetypes.js"
  @ONLY COPYONLY
)
configure_file(
  "utils.js"
  "${CMAKE_CURRENT_BINARY_DIR}/utils.js"
  @ONLY COPYONLY
)
configure_file(
  "webdav.js"
  "${CMAKE_CURRENT_BINARY_DIR}/webdav.js"
  @ONLY COPYONLY
)
configure_file(
  "translations.js"
  "${CMAKE_CURRENT_BINARY_DIR}/translations.js"
  @ONLY COPYONLY
)

add_custom_target(
  copy_modules ALL
  COMMAND ${CMAKE_COMMAND} -E create_symlink
    "${CMAKE_CURRENT_SOURCE_DIR}/node_modules"
    "${CMAKE_CURRENT_BINARY_DIR}/node_modules"
)

# Install the scope ini, image, and js files
install(
  FILES
    "${CMAKE_CURRENT_BINARY_DIR}/${SCOPE_NAME}.ini"
    "${CMAKE_CURRENT_BINARY_DIR}/${SCOPE_NAME}-settings.ini"
    "${CMAKE_CURRENT_BINARY_DIR}/icon.png"
    "${CMAKE_CURRENT_BINARY_DIR}/logo.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_text.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_doc.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_zip.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_sound.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_code.png"
    "${CMAKE_CURRENT_BINARY_DIR}/error.svg"
    "${CMAKE_CURRENT_BINARY_DIR}/file.png"
    "${CMAKE_CURRENT_BINARY_DIR}/folder.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_image.png"
    "${CMAKE_CURRENT_BINARY_DIR}/parent.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_pdf.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_movie.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_ppt.png"
    "${CMAKE_CURRENT_BINARY_DIR}/file_xls.png"
    "${CMAKE_CURRENT_BINARY_DIR}/${SCOPE_NAME}.js"
    "${CMAKE_CURRENT_BINARY_DIR}/filetypes.js"
    "${CMAKE_CURRENT_BINARY_DIR}/utils.js"
    "${CMAKE_CURRENT_BINARY_DIR}/webdav.js"
    "${CMAKE_CURRENT_BINARY_DIR}/translations.js"
  DESTINATION
    ${SCOPE_INSTALL_DIR}
)

install(
  DIRECTORY
    "${CMAKE_CURRENT_SOURCE_DIR}/node_modules"
  DESTINATION
    ${SCOPE_INSTALL_DIR}
  USE_SOURCE_PERMISSIONS
)
