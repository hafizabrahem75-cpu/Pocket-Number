{pkgs}: {
  deps = [
    pkgs.systemd
    pkgs.libgbm
    pkgs.expat
    pkgs.alsa-lib
    pkgs.pango
    pkgs.cairo
    pkgs.mesa
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.libxkbcommon
    pkgs.xorg.libxcb
    pkgs.cups
    pkgs.at-spi2-core
    pkgs.at-spi2-atk
    pkgs.dbus
    pkgs.nss
    pkgs.nspr
    pkgs.glib
  ];
}
