intltool_update_potfile(
  ALL
  KEYWORDS "_" "_:1,2" "tr" "tr:1,2" "dtr:2" "dtr:2,3" "N_"
  #UBUNTU_SDK_DEFAULTS
  COPYRIGHT_HOLDER ""
  POTFILES_TEMPLATE "POTFILES.in.in"
  GETTEXT_PACKAGE ${GETTEXT_PACKAGE}
)

intltool_install_translations(
  ALL
  GETTEXT_PACKAGE ${GETTEXT_PACKAGE}
)
