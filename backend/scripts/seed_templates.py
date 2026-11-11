"""
Seed Global Templates
Populates database with default device and connection templates
Run with: python -m backend.scripts.seed_templates
"""

import asyncio
import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.template import DeviceTemplate, ConnectionTemplate


# Default Device Templates (from frontend/src/store/templateStore.ts)
DEFAULT_DEVICE_TEMPLATES = [
    {
        "id": "tpl-pc",
        "name": "PC",
        "type": "PC",
        "icon": "solar:monitor-bold-duotone",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-switch",
        "name": "Switch",
        "type": "Switch",
        "icon": "carbon:network-4",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": True,
        "supportsSTP": True,
        "supportsPorts": True,
        "supportsNICs": False,
        "portOptions": [5, 8, 16, 24, 48],
        "defaultPortCount": 24,
    },
    {
        "id": "tpl-router",
        "name": "Router",
        "type": "Router",
        "icon": "mdi:router-network",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": True,
        "supportsSTP": True,
        "supportsPorts": True,
        "supportsNICs": False,
        "portOptions": [2, 4, 8, 16],
        "defaultPortCount": 8,
    },
    {
        "id": "tpl-server",
        "name": "Server",
        "type": "Server",
        "icon": "mdi:server",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-firewall",
        "name": "Firewall",
        "type": "Firewall",
        "icon": "mdi:shield-network",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": True,
        "supportsSTP": True,
        "supportsPorts": True,
        "supportsNICs": False,
        "portOptions": [2, 4, 8, 16],
        "defaultPortCount": 8,
    },
    {
        "id": "tpl-accesspoint",
        "name": "Access Point",
        "type": "AccessPoint",
        "icon": "mdi:access-point",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-loadbalancer",
        "name": "Load Balancer",
        "type": "LoadBalancer",
        "icon": "mdi:scale-balance",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-database",
        "name": "Database",
        "type": "Database",
        "icon": "mdi:database",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-cloud",
        "name": "Cloud",
        "type": "Cloud",
        "icon": "mdi:cloud",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    # === Server Applicativi (type: Server) ===
    {
        "id": "tpl-mailserver",
        "name": "Mail Server",
        "type": "Server",  # Base type: Server
        "icon": "mdi:email-fast",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-vps",
        "name": "VPS",
        "type": "Server",  # Base type: Server
        "icon": "mdi:cloud-outline",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-webserver",
        "name": "Web Server",
        "type": "Server",  # Base type: Server
        "icon": "mdi:web",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-proxy",
        "name": "Proxy Server",
        "type": "Server",  # Base type: Server
        "icon": "mdi:shield-half-full",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    # === Storage (type: Database) ===
    {
        "id": "tpl-storage-s3",
        "name": "Storage S3",
        "type": "Database",  # Base type: Database
        "icon": "mdi:bucket",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-nas",
        "name": "NAS",
        "type": "Database",  # Base type: Database
        "icon": "mdi:nas",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    # === Network Services (type: Server) ===
    {
        "id": "tpl-dnsserver",
        "name": "DNS Server",
        "type": "Server",  # Base type: Server
        "icon": "mdi:dns",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-dhcpserver",
        "name": "DHCP Server",
        "type": "Server",  # Base type: Server
        "icon": "mdi:ip-network",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    # === Endpoint / IoT ===
    {
        "id": "tpl-iotgateway",
        "name": "IoT Gateway",
        "type": "AccessPoint",  # Base type: AccessPoint
        "icon": "mdi:router-wireless-settings",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-ipcamera",
        "name": "IP Camera",
        "type": "PC",  # Base type: PC (endpoint)
        "icon": "mdi:cctv",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
    {
        "id": "tpl-printer",
        "name": "Printer",
        "type": "PC",  # Base type: PC (endpoint)
        "icon": "mdi:printer-wireless",
        "color": "#5B7C8D",
        "isCustom": False,
        "supportsVLAN": False,
        "supportsSTP": False,
        "supportsPorts": False,
        "supportsNICs": True,
    },
]


# Default Connection Templates (from frontend/src/store/templateStore.ts)
DEFAULT_CONNECTION_TEMPLATES = [
    {
        "id": "conn-access",
        "name": "Access",
        "type": "access",
        "description": "Porta di accesso a dispositivi finali",
        "color": "#3b82f6",  # Blue
        "lineStyle": "solid",
        "strokeWidth": 2.5,
        "strokeWidthHighlighted": 4,
        "isCustom": False,
    },
    {
        "id": "conn-trunk",
        "name": "Trunk",
        "type": "trunk",
        "description": "Link trunk tra switch",
        "color": "#9333ea",  # Purple
        "lineStyle": "solid",
        "strokeWidth": 3.5,
        "strokeWidthHighlighted": 5,
        "isCustom": False,
    },
    {
        "id": "conn-uplink",
        "name": "Uplink",
        "type": "uplink",
        "description": "Uplink a core/internet",
        "color": "#f59e0b",  # Orange
        "lineStyle": "dashed",
        "strokeWidth": 3,
        "strokeWidthHighlighted": 4.5,
        "strokeDasharray": "8 4",
        "isCustom": False,
    },
    {
        "id": "conn-backbone",
        "name": "Backbone",
        "type": "backbone",
        "description": "Infrastruttura critica",
        "color": "#ef4444",  # Red
        "lineStyle": "dotted",
        "strokeWidth": 4,
        "strokeWidthHighlighted": 6,
        "strokeDasharray": "1 5",
        "isCustom": False,
    },
    {
        "id": "conn-mpls",
        "name": "MPLS",
        "type": "mpls",
        "description": "Connessione MPLS WAN",
        "color": "#10b981",  # Green
        "lineStyle": "dashed",
        "strokeWidth": 3.5,
        "strokeWidthHighlighted": 5,
        "strokeDasharray": "12 6",
        "isCustom": False,
    },
]


async def seed_templates():
    """Seed global device and connection templates (adds missing templates)"""
    async with AsyncSessionLocal() as db:
        try:
            print("[*] Starting template seeding...")

            # Get existing device templates
            result = await db.execute(
                select(DeviceTemplate).where(DeviceTemplate.user_id.is_(None))
            )
            existing_device_templates = result.scalars().all()
            existing_device_ids = {t.template.get('id') for t in existing_device_templates}
            print(f"  [i] Found {len(existing_device_templates)} existing device templates")

            # Add only missing device templates
            device_count = 0
            for template_data in DEFAULT_DEVICE_TEMPLATES:
                if template_data['id'] not in existing_device_ids:
                    new_template = DeviceTemplate(
                        user_id=None,  # Global template
                        is_custom=False,
                        template=template_data
                    )
                    db.add(new_template)
                    device_count += 1
                    print(f"  [+] Created device template: {template_data['name']}")

            # Get existing connection templates
            result = await db.execute(
                select(ConnectionTemplate).where(ConnectionTemplate.user_id.is_(None))
            )
            existing_connection_templates = result.scalars().all()
            existing_connection_ids = {t.template.get('id') for t in existing_connection_templates}
            print(f"  [i] Found {len(existing_connection_templates)} existing connection templates")

            # Add only missing connection templates
            connection_count = 0
            for template_data in DEFAULT_CONNECTION_TEMPLATES:
                if template_data['id'] not in existing_connection_ids:
                    new_template = ConnectionTemplate(
                        user_id=None,  # Global template
                        is_custom=False,
                        template=template_data
                    )
                    db.add(new_template)
                    connection_count += 1
                    print(f"  [+] Created connection template: {template_data['name']}")

            await db.commit()

            print(f"\n[OK] Seeding completed!")
            print(f"   Device templates: {device_count} created")
            print(f"   Connection templates: {connection_count} created")

        except Exception as e:
            print(f"\n[ERROR] Error during seeding: {e}")
            await db.rollback()
            raise


def main():
    """Main entry point"""
    print("=" * 60)
    print("Pixelcake Template Seeder")
    print("=" * 60)
    asyncio.run(seed_templates())


if __name__ == "__main__":
    main()
