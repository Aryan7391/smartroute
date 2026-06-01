export default {
  "expo": {
    "name": "driver-apk",
    "slug": "driver-apk",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "android": {
      "package": "com.smartroute.driver",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ],
      "config": {
        "googleMaps": {
          "apiKey": process.env.EXPO_PUBLIC_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY_HERE"
        }
      }
    },
    "plugins": [
      "expo-font",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow SmartRoute to use your location for delivery tracking."
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "d9fb46f6-45b9-42db-a7dd-90dc721685d2"
      }
    }
  }
};
