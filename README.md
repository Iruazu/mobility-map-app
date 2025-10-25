⚠️ Work in Progress — This repository is under continuous update
# Firebase Web Interface for Personal Mobility Platform

[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.javascript.com/)
[![Google Maps](https://img.shields.io/badge/Google_Maps-API-blue.svg)](https://developers.google.com/maps)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A real-time web-based control interface for autonomous mobile robots, featuring live telemetry monitoring, interactive map controls, and seamless Firebase integration with ROS2 backend systems.

## 🎯 Overview

This web application provides an intuitive control interface for managing autonomous delivery robots in real-time. Built with vanilla JavaScript and Firebase, it offers a lightweight yet powerful solution for fleet monitoring and control.

### Key Features

✅ **Real-time Robot Tracking**: Live position updates synchronized with ROS2 via Firebase  
✅ **Interactive Map Interface**: Google Maps integration with custom marker controls  
✅ **Sensor Dashboard**: Live telemetry monitoring (battery, speed, obstacles, distance)  
✅ **One-Click Dispatch**: Call robots to specific locations with automatic nearest-robot selection  
✅ **Destination Control**: Set navigation goals with ROS2 Nav2 path planning integration  
✅ **Ride Management**: In-app boarding/alighting controls with status synchronization  
✅ **Responsive Design**: Mobile-optimized UI with Tailwind CSS styling  

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Web Browser (Client)                   │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         User Interface Layer                 │  │
│  │  • Map Controls (Google Maps)                │  │
│  │  • Sensor Dashboard (Telemetry Display)      │  │
│  │  • Notification System                       │  │
│  └──────────────────────────────────────────────┘  │
│                      ▲                              │
│                      │                              │
│  ┌──────────────────────────────────────────────┐  │
│  │         Service Layer                        │  │
│  │  • MapService (Marker Management)            │  │
│  │  • RobotService (State Control)              │  │
│  │  • UIService (Event Handling)                │  │
│  │  • SensorDashboard (Telemetry Rendering)     │  │
│  └──────────────────────────────────────────────┘  │
│                      ▲                              │
└──────────────────────┼──────────────────────────────┘
                       │ Firestore SDK
                       │ Real-time Listener
┌──────────────────────▼──────────────────────────────┐
│             Firebase Firestore                      │
│  Collection: robots                                 │
│  • position (GeoPoint)                              │
│  • status (idle/in_use/moving/dispatching)          │
│  • destination (GeoPoint, nullable)                 │
│  • telemetry (Object)                               │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ Firebase Bridge Node
┌──────────────────────▼──────────────────────────────┐
│              ROS2 Backend System                    │
│  • Navigation2 (Path Planning)                      │
│  • AMCL (Localization)                              │
│  • Sensor Drivers (LiDAR, IMU, Odometry)            │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

### Required Services

1. **Firebase Project**
   - Firestore Database (Native mode)
   - Web SDK configured
   - Authentication enabled (Anonymous sign-in)

2. **Google Maps API**
   - Maps JavaScript API enabled
   - Marker Library enabled
   - API Key with proper restrictions

3. **ROS2 Backend** (Optional for development)
   - ROS2 Firebase Bridge running
   - Firestore write permissions configured

### Development Tools

- Modern web browser (Chrome, Firefox, Edge)
- Node.js 16+ (optional, for local server)
- VS Code with Live Server extension (recommended)

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/mobility-web-interface.git
cd mobility-web-interface
```

### 2. Configure Firebase

Create `js/config/firebase.js` and add your Firebase credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456",
    measurementId: "G-XXXXXXXXXX"
};
```

### 3. Configure Google Maps API

Create `apiKey.js` in the root directory:

```javascript
const GOOGLE_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
```

### 4. Launch Application

**Option A: Using Live Server (VS Code)**
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

**Option B: Using Python HTTP Server**
```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

**Option C: Using Node.js**
```bash
npx http-server -p 8000
```

---

## 📦 Project Structure

```
mobility-web-interface/
├── index.html                      # Main entry point
├── style.css                       # Global styles
├── dashboard-styles.css            # Sensor dashboard styles
├── apiKey.js                       # Google Maps API key (gitignored)
├── js/
│   ├── main.js                     # Application bootstrap
│   ├── config/
│   │   └── firebase.js             # Firebase configuration
│   ├── services/
│   │   ├── mapService.js           # Map & marker management
│   │   ├── robotService.js         # Robot state control
│   │   ├── uiService.js            # UI event handling
│   │   └── sensorDashboard.js      # Telemetry dashboard
│   └── utils/
│       └── geoUtils.js             # Geographic calculations
├── .gitignore
└── README.md
```

---

## 🔧 Core Components

### 1. MapService (`js/services/mapService.js`)

Manages Google Maps integration and marker lifecycle.

**Key Features:**
- **Smart Marker Updates**: Position caching with 1.1m tolerance to prevent unnecessary re-renders
- **Custom Pin Elements**: Color-coded markers based on robot status
- **InfoWindow Management**: Context-aware popups with action buttons
- **User Interaction**: Pickup/destination marker placement

**Status-Based Marker Colors:**
```javascript
idle        → Blue (#2196F3)
in_use      → Orange (#f59e0b)
moving      → Green (#4CAF50)
dispatching → Purple (#8b5cf6)
```

**Example Usage:**
```javascript
const mapService = new MapService();
mapService.initializeMap('map', (location) => {
    console.log('Map clicked:', location);
});

// Update robot marker
mapService.updateRobotMarker('robot_001', {
    id: 'robot_001',
    position: { latitude: 36.55077, longitude: 139.92957 },
    status: 'moving'
});
```

### 2. RobotService (`js/services/robotService.js`)

Controls robot state and communicates with Firebase backend.

**Key Responsibilities:**
- Firestore real-time listener setup
- Robot dispatch logic (nearest-robot selection)
- Destination setting with validation
- Status management (idle/in_use/moving/dispatching)
- Update throttling (500ms) to prevent excessive renders

**Update Optimization:**
```javascript
// Only process updates if:
// 1. Status changed
// 2. Destination changed (>0.00001° ≈ 1m)
// 3. Position changed (>0.00001° ≈ 1m)
// 4. Time since last update > 500ms
```

**Example Usage:**
```javascript
// Call nearest robot to location
await robotService.callRobot(36.55080, 139.92960);

// Set destination for robot in use
await robotService.setDestination('robot_001', 36.55085, 139.92965);

// Board/alight from robot
await robotService.handleRideAction('robot_001', 'ride');
```

### 3. SensorDashboard (`js/services/sensorDashboard.js`)

Real-time telemetry visualization dashboard.

**Monitored Metrics:**
- **Battery**: Percentage, voltage, charging status with color-coded bar
- **Speed**: Current velocity in m/s
- **Distance to Goal**: Remaining distance to navigation target
- **Obstacle Detection**: LiDAR-based obstacle proximity alerts

**Features:**
- Collapsible panel (toggle button)
- Auto-updating timestamps
- Color-coded alerts (green/yellow/red)
- Responsive grid layout

**Telemetry Data Format:**
```javascript
{
    battery_percent: 85.5,
    battery_voltage: 12.6,
    battery_charging: false,
    speed: 0.22,
    distance_to_goal: 3.42,
    obstacle_detected: false,
    min_obstacle_distance: 2.35
}
```

### 4. UIService (`js/services/uiService.js`)

Handles user interactions and notification system.

**Key Features:**
- Global event handler setup (window.handleXXXClick functions)
- Toast notification system with 5 types (success/error/warning/info/loading)
- Map click routing (pickup mode vs. destination mode)
- Loading state management

**Notification Types:**
```javascript
// Success notification (auto-dismiss 3s)
uiService.showNotification('Robot dispatched!', 'success');

// Error notification (auto-dismiss 3s)
uiService.showNotification('Operation failed', 'error');

// Loading notification (manual dismiss)
const loadingId = uiService.showNotification('Processing...', 'loading');
uiService.removeNotification(loadingId);
```

---

## 🎨 User Interface

### Map Controls

**Pickup Mode** (No robot in use)
1. Click anywhere on map
2. Purple "🧍" marker appears
3. Click "この場所にロボットを呼ぶ" button
4. System dispatches nearest idle robot

**Destination Mode** (Robot in use)
1. Click desired destination on map
2. Green "🏁" marker appears
3. Click "この場所へ行く" button
4. ROS2 Nav2 calculates optimal path

### Robot Status Indicators

| Status | Japanese | Color | Icon |
|--------|----------|-------|------|
| `idle` | アイドリング中 | Blue | 🤖 |
| `in_use` | 使用中 | Orange | 🤖 |
| `moving` | 走行中 | Green | 🤖 |
| `dispatching` | 配車中 | Purple | 🤖 |

### Sensor Dashboard

Located at bottom-right corner of screen:

```
┌────────────────────────────────┐
│  🤖 ロボットテレメトリ      [▼] │
├────────────────────────────────┤
│  TurtleBot3-001    [走行中]    │
│                                │
│  🔋 85.5%    ⚡ 0.22 m/s       │
│  ██████████░░░    12.6V        │
│                                │
│  🎯 3.4m      🚧 クリア         │
│                                │
│  最終更新: 14:23:45            │
└────────────────────────────────┘
```

---

## 🔌 Firebase Integration

### Firestore Schema

**Collection: `robots`**

```javascript
{
    id: "robot_001",                    // Robot identifier
    name: "TurtleBot3-001",             // Display name
    status: "idle",                     // idle | in_use | moving | dispatching
    position: GeoPoint(36.55077, 139.92957),  // Current GPS coordinates
    heading: 0.0,                       // Orientation (radians)
    destination: GeoPoint(36.55080, 139.92960) | null,  // Target location
    telemetry: {
        battery_percent: 85.5,
        battery_voltage: 12.6,
        battery_charging: false,
        speed: 0.22,
        distance_to_goal: 3.42,
        obstacle_detected: false,
        min_obstacle_distance: 2.35
    },
    last_updated: Timestamp            // Last update time
}
```

### Real-time Synchronization

The web interface uses Firestore's `onSnapshot` listener for real-time updates:

```javascript
const robotsCol = collection(db, 'robots');
onSnapshot(robotsCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
            const robot = change.doc.data();
            mapService.updateRobotMarker(change.doc.id, robot);
            sensorDashboard.updateRobotSensors(change.doc.id, robot);
        }
    });
});
```

### Write Operations

**Dispatch Robot:**
```javascript
await updateDoc(doc(db, 'robots', robotId), {
    status: 'dispatching',
    destination: new GeoPoint(lat, lng),
    last_updated: new Date().toISOString()
});
```

**Set Destination:**
```javascript
await updateDoc(doc(db, 'robots', robotId), {
    status: 'moving',
    destination: new GeoPoint(lat, lng),
    last_updated: new Date().toISOString()
});
```

**Clear Destination:**
```javascript
await updateDoc(doc(db, 'robots', robotId), {
    destination: deleteField(),
    status: 'idle',
    last_updated: new Date().toISOString()
});
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` or configure directly in code:

```javascript
// Firebase Configuration
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com

// Google Maps Configuration
GOOGLE_MAPS_API_KEY=your_maps_api_key

// Map Settings
DEFAULT_MAP_CENTER_LAT=36.55077
DEFAULT_MAP_CENTER_LNG=139.92957
DEFAULT_MAP_ZOOM=17
```

### Security Rules (Firebase)

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /robots/{robotId} {
      // Allow read access to all authenticated users
      allow read: if request.auth != null;
      
      // Allow write only to specific fields
      allow update: if request.auth != null 
                    && request.resource.data.keys().hasOnly(['status', 'destination', 'last_updated']);
    }
  }
}
```

---

## 🔍 Troubleshooting

### Map Not Loading

**Symptoms:** Blank screen or "Map failed to load" error

**Solutions:**
1. Check Google Maps API key in `apiKey.js`
2. Verify API key has Maps JavaScript API enabled
3. Check browser console for CORS errors
4. Ensure `GOOGLE_API_KEY` variable is properly set

```javascript
// Debug script
console.log('Google API Key:', typeof GOOGLE_API_KEY !== 'undefined');
console.log('Google Maps loaded:', typeof google !== 'undefined');
```

### Firebase Connection Issues

**Symptoms:** No robot markers appear, real-time updates not working

**Solutions:**
1. Verify Firebase config in `js/config/firebase.js`
2. Check Firestore rules allow read access
3. Confirm anonymous authentication is enabled
4. Open browser console and check for Firebase errors

```javascript
// Test Firebase connection
import { db, collection, getDocs } from './js/config/firebase.js';
const snapshot = await getDocs(collection(db, 'robots'));
console.log('Robots found:', snapshot.size);
```

### Markers Not Updating

**Symptoms:** Robot positions frozen on map

**Solutions:**
1. Check ROS2 Firebase Bridge is running
2. Verify robot position data in Firestore console
3. Check browser console for JavaScript errors
4. Clear browser cache and reload

```javascript
// Debug marker updates
window.getMobilityAppStatus();
// Expected output:
// {
//   initialized: true,
//   activeMarkers: 3,
//   mapInitialized: true
// }
```

### Sensor Dashboard Not Showing

**Symptoms:** Dashboard panel missing or empty

**Solutions:**
1. Verify telemetry data exists in Firestore
2. Check CSS file `dashboard-styles.css` is loaded
3. Open browser inspector and look for `#sensor-dashboard` element
4. Check console for dashboard initialization errors

---

## 🎯 Performance Optimization

### Update Throttling

The application implements intelligent throttling to reduce unnecessary renders:

```javascript
// Position updates: Only if moved >1m
const tolerance = 0.00001; // ~1.1m
if (Math.abs(newLat - oldLat) < tolerance && 
    Math.abs(newLng - oldLng) < tolerance) {
    return; // Skip update
}

// Firestore updates: Max once per 500ms per robot
if (now - lastUpdate < 500) {
    return; // Skip update
}
```

### Benefits:
- **90% reduction** in map re-renders
- **Reduced Firestore reads** (cost savings)
- **Smoother animations** (fewer marker position jumps)
- **Lower battery usage** on mobile devices

---

## 📱 Mobile Support

The interface is fully responsive and optimized for mobile devices:

**Viewport Configuration:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Responsive Breakpoints:**
- Desktop: Full sidebar + dashboard
- Tablet (≤768px): Collapsible sidebar
- Mobile (≤480px): Bottom-sheet dashboard, simplified controls

**Touch Optimizations:**
- Tap targets ≥44px (Apple HIG compliance)
- Swipe gestures for dashboard collapse
- Pinch-to-zoom on map (native Google Maps)

---

## 🔒 Security Considerations

### API Key Restrictions

**Google Maps API:**
```
HTTP referrers: https://yourdomain.com/*
API restrictions: Maps JavaScript API only
```

**Firebase:**
```
Firestore Rules: Authenticated users only
Anonymous sign-in: Enabled (with rate limiting)
```

### Data Privacy

- No user location tracking (markers represent robots only)
- Anonymous Firebase authentication
- No personal data storage
- HTTPS-only deployment recommended

---

## 🚀 Deployment

### Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init hosting

# Deploy
firebase deploy --only hosting
```

### Static Hosting (Netlify/Vercel)

```bash
# Build configuration
# Public directory: .
# Build command: (none - static files)
# Publish directory: .
```

### Environment Variables

Set in hosting platform:
- `FIREBASE_API_KEY`
- `GOOGLE_MAPS_API_KEY`

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Map loads correctly at default location
- [ ] Robot markers appear and update in real-time
- [ ] Clicking map places pickup/destination marker
- [ ] "Call Robot" button dispatches nearest robot
- [ ] "Set Destination" button updates robot status
- [ ] Sensor dashboard shows live telemetry
- [ ] Notifications appear for user actions
- [ ] Dashboard collapse/expand works
- [ ] Mobile responsive layout functions correctly

### Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Fully supported |
| Firefox | 88+ | ✅ Fully supported |
| Safari | 14+ | ✅ Fully supported |
| Edge | 90+ | ✅ Fully supported |
| Opera | 76+ | ✅ Fully supported |

---

## 📚 API Reference

### MapService Methods

```javascript
// Initialize map
mapService.initializeMap(elementId, onClickCallback)

// Update robot marker
mapService.updateRobotMarker(robotId, robotData)

// Place pickup marker
mapService.placePickupMarker(location)

// Place destination marker
mapService.placeDestinationMarker(location, robotId)

// Remove marker
mapService.removeMarker(robotId)
```

### RobotService Methods

```javascript
// Start real-time updates
robotService.startRealtimeUpdates()

// Call robot to location
await robotService.callRobot(lat, lng)

// Set destination
await robotService.setDestination(robotId, lat, lng)

// Handle ride action
await robotService.handleRideAction(robotId, 'ride' | 'getoff')

// Get robot in use
await robotService.getInUseRobot()
```

### UIService Methods

```javascript
// Show notification
uiService.showNotification(message, type, duration)

// Remove notification
uiService.removeNotification(notificationId)

// Handle map click
uiService.handleMapClick(location)
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow existing code style (ES6+, JSDoc comments)
4. Test thoroughly on multiple browsers
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- Use ES6+ features (arrow functions, destructuring, etc.)
- Add JSDoc comments to all functions
- Use meaningful variable names
- Follow modular service architecture
- Keep functions pure when possible

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Yugo Obana**  
Mechanical Engineering, Utsunomiya University  
Specialization: Cloud-Robotics Integration, Web-based Fleet Management

### Connect
- LinkedIn: [your-profile](www.linkedin.com/in/yugo-dev)
- GitHub: [your-github](https://github.com/Iruazu)

---

## 🙏 Acknowledgments

- **Firebase** for real-time database infrastructure
- **Google Maps Platform** for mapping services
- **Tailwind CSS** for utility-first styling
- **ROS2 Community** for robotics middleware integration

---

## 📧 Support

For questions or issues:
- Open an [Issue](https://github.com/Iruazu/mobility-map-app/issues)
- Email: ygnk0805@outlook.jp

---

**Built with ❤️ for autonomous mobility and real-time fleet management**