#!/usr/bin/env python3
"""
CTF Platform Launcher
Inicia automáticamente la plataforma CTF
"""

import subprocess
import sys
import os
import webbrowser
import time

# Obtener directorio del script (funciona en cualquier PC)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def check_node():
    """Verifica si Node.js está instalado"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        print(f"Node.js {result.stdout.strip()} detectado")
        return True
    except FileNotFoundError:
        print("ERROR: Node.js no está instalado")
        print("Descárgalo en: https://nodejs.org/")
        return False

def install_dependencies():
    """Instala las dependencias de npm si no existen"""
    node_modules = os.path.join(SCRIPT_DIR, 'node_modules')
    
    if not os.path.exists(node_modules):
        print("Instalando dependencias...")
        subprocess.run(['npm', 'install'], cwd=SCRIPT_DIR, shell=True)
        print("Dependencias instaladas")
    else:
        print("Dependencias ya instaladas")

def start_server():
    """Inicia el servidor CTF"""
    print("\n" + "="*50)
    print("  CTF PLATFORM")
    print("="*50)
    print("  URL:   http://localhost:3000")
    print("  Admin: admin / CTF@dm1n!2026$SecurePwd")
    print("="*50)
    print("\nPresiona Ctrl+C para detener el servidor\n")
    
    # Abrir navegador después de 2 segundos
    def open_browser():
        time.sleep(2)
        webbrowser.open('http://localhost:3000')
    
    import threading
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Iniciar servidor
    try:
        subprocess.run(['node', 'server.js'], cwd=SCRIPT_DIR)
    except KeyboardInterrupt:
        print("\nServidor detenido")

def main():
    print("CTF Platform Launcher")
    print("-" * 30)
    
    if not check_node():
        input("Presiona Enter para salir...")
        sys.exit(1)
    
    install_dependencies()
    start_server()

if __name__ == '__main__':
    main()
