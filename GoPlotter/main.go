// main.go
package main

import (
	"fmt"
	"log"
	"net/http"
	"sfaf-plotter/config"
	"sfaf-plotter/handlers"
	"sfaf-plotter/middleware"
	"sfaf-plotter/repositories"
	"sfaf-plotter/services"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// Helper function to join string slices
func joinStrings(arr []string) string {
	result := ""
	for i, s := range arr {
		if i > 0 {
			result += ", "
		}
		result += s
	}
	return result
}

func main() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
	} else {
		log.Println("✅ Loaded configuration from .env file")
	}

	// Load application configuration
	appConfig := config.Load()
	appConfig.PrintConfiguration()

	// Initialize structured logger
	logger, err := config.InitLogger(appConfig)
	if err != nil {
		log.Fatal("Failed to initialize logger:", err)
	}
	defer logger.Sync()

	// Set global logger for use throughout the application
	config.SetLogger(logger)

	logger.Info("Application starting",
		zap.String("version", "1.0.0"),
		zap.String("mode", appConfig.Server.GinMode),
	)

	// Set Gin mode based on configuration
	gin.SetMode(appConfig.Server.GinMode)

	// Initialize database connection
	db, dbErr := config.ConnectDatabase()
	if dbErr != nil {
		logger.Fatal("Failed to connect to database", zap.Error(dbErr))
	}
	defer db.Close()

	// Wrap with sqlx for enhanced functionality
	sqlxDB := sqlx.NewDb(db, "postgres")

	// Initialize repositories
	markerRepo := repositories.NewMarkerRepository(sqlxDB)
	iracNotesRepo := repositories.NewIRACNotesRepository(sqlxDB)
	sfafRepo := repositories.NewSFAFRepository(sqlxDB)
	sfafFieldOccRepo := repositories.NewSFAFFieldOccurrenceRepository(sqlxDB)
	geometryRepo := repositories.NewGeometryRepository(sqlxDB)
	frequencyRepo := repositories.NewFrequencyRepository(sqlxDB)

	// Initialize services
	serialService := services.NewSerialService(sqlxDB)
	coordService := services.NewCoordinateService()
	markerService := services.NewMarkerService(markerRepo, iracNotesRepo, serialService, coordService)
	sfafService := services.NewSFAFService(sfafRepo, sfafFieldOccRepo, coordService)
	field530Service := services.NewField530Service(sfafRepo, coordService)

	// Wire up marker service to SFAF service for import functionality
	sfafService.SetMarkerService(markerService)
	sfafService.SetSerialService(serialService)

	// Update existing imported markers to be non-draggable
	logger.Info("Updating imported markers to be non-draggable")
	if err := markerRepo.UpdateImportedMarkersDraggable(); err != nil {
		logger.Warn("Failed to update imported markers draggable status", zap.Error(err))
	} else {
		logger.Info("Successfully updated imported markers to non-draggable")
	}

	geometryService := services.NewGeometryService(geometryRepo, markerService, serialService, coordService)
	frequencyService := services.NewFrequencyService(frequencyRepo)

	// Initialize handlers with properly created services
	markerHandler := handlers.NewMarkerHandler(markerService)
	sfafHandler := handlers.NewSFAFHandler(sfafService, markerService, field530Service)
	geometryHandler := handlers.NewGeometryHandler(geometryService)
	frequencyHandler := handlers.NewFrequencyHandler(frequencyService)

	// Setup Gin router (without default middleware)
	r := gin.New()

	// Add custom middleware
	r.Use(middleware.Recovery(logger))  // Panic recovery with logging
	r.Use(middleware.Logger(logger))    // Request logging

	// Development authentication bypass (only active when GIN_MODE=debug)
	devMode := appConfig.Server.GinMode == "debug"
	if devMode {
		logger.Warn("⚠️  Development authentication bypass is ACTIVE - DO NOT USE IN PRODUCTION")
	}
	r.Use(middleware.DevAuthMiddleware(devMode, logger))

	// CORS middleware (configured from .env)
	r.Use(func(c *gin.Context) {
		origin := "*"
		if len(appConfig.CORS.AllowedOrigins) > 0 && appConfig.CORS.AllowedOrigins[0] != "*" {
			origin = appConfig.CORS.AllowedOrigins[0]
		}

		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", joinStrings(appConfig.CORS.AllowedMethods))
		c.Header("Access-Control-Allow-Headers", joinStrings(appConfig.CORS.AllowedHeaders))

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Static file serving
	r.Static("/css", "./web/static/css")
	r.Static("/images", "./web/static/images")
	r.Static("/js", "./web/static/js")
	r.Static("/references", "./web/static/references")
	r.LoadHTMLGlob("web/templates/*")

	// Landing page route
	r.GET("/", func(c *gin.Context) {
		c.HTML(200, "landing.html", gin.H{
			"title": "SFAF Plotter - Military Frequency Coordination Platform",
		})
	})

	// Map viewer route (moved from root)
	r.GET("/map-viewer", func(c *gin.Context) {
		c.HTML(200, "map_viewer.html", gin.H{
			"title": "SFAF Plotter - Map Viewer",
		})
	})

	// Add database viewer route (Source: main.txt pattern)
	r.GET("/database", func(c *gin.Context) {
		c.HTML(200, "db_viewer.html", gin.H{
			"title": "SFAF Plotter - Database Viewer",
		})
	})

	// Add table manager route (formerly view manager)
	r.GET("/view-manager", func(c *gin.Context) {
		c.HTML(200, "view_manager.html", gin.H{
			"title": "SFAF Table Manager",
		})
	})

	// Add frequency nomination route
	r.GET("/frequency-nomination", func(c *gin.Context) {
		c.HTML(200, "frequency_nomination.html", gin.H{
			"title": "Frequency Nomination & Deconfliction",
		})
	})

	// Add user profile route
	r.GET("/profile", func(c *gin.Context) {
		c.HTML(200, "profile.html", gin.H{
			"title": "SFAF Plotter - User Profile",
		})
	})

	// Add frequency management routes
	r.GET("/frequency/assignments", func(c *gin.Context) {
		c.HTML(200, "unit_frequencies.html", gin.H{
			"title": "Unit Frequencies",
		})
	})

	r.GET("/frequency/request", func(c *gin.Context) {
		c.HTML(200, "request_frequency.html", gin.H{
			"title": "Request Frequency",
		})
	})

	r.GET("/frequency/requests", func(c *gin.Context) {
		c.HTML(200, "request_dashboard.html", gin.H{
			"title": "Frequency Requests",
		})
	})

	// API routes
	api := r.Group("/api")
	{

		api.GET("/convert-coords", func(c *gin.Context) {
			lat := c.Query("lat")
			lng := c.Query("lng")

			latFloat, _ := strconv.ParseFloat(lat, 64)
			lngFloat, _ := strconv.ParseFloat(lng, 64)

			// Use coordinate service for conversion
			coordFormats := coordService.GetAllFormats(latFloat, lngFloat)

			c.JSON(http.StatusOK, gin.H{
				"decimal": fmt.Sprintf("%.4f, %.4f", latFloat, lngFloat),
				"dms":     coordFormats.DMS,
				"compact": coordFormats.Compact,
			})
		})

		// Existing marker management routes
		api.POST("/markers", markerHandler.CreateMarker)
		api.GET("/markers", markerHandler.GetAllMarkers)
		api.GET("/markers/bounds", markerHandler.GetMarkersByBounds) // Viewport-based loading
		api.GET("/markers/:id", markerHandler.GetMarker)
		api.PUT("/markers/:id", markerHandler.UpdateMarker)
		api.DELETE("/markers/:id", markerHandler.DeleteMarker)
		api.DELETE("/markers", markerHandler.DeleteAllMarkers)

		// IRAC Notes management routes
		api.GET("/irac-notes", markerHandler.GetIRACNotes)
		api.POST("/markers/irac-notes", markerHandler.AddIRACNoteToMarker)
		api.DELETE("/markers/irac-notes", markerHandler.RemoveIRACNoteFromMarker)

		// SFAF ROUTES
		api.POST("/sfaf", sfafHandler.CreateSFAF)
		api.GET("/sfaf/object-data/:marker_id", sfafHandler.GetObjectData)
		api.PUT("/sfaf/:id", sfafHandler.UpdateSFAF)
		api.DELETE("/sfaf/:id", sfafHandler.DeleteSFAF)
		api.GET("/sfaf", sfafHandler.GetAllSFAFs)
		api.GET("/sfaf/:id", sfafHandler.GetSFAF)
		api.GET("/sfaf/marker/:marker_id", sfafHandler.GetSFAFByMarkerID)
		api.POST("/sfaf/validate", sfafHandler.ValidateFields)
		api.GET("/sfaf/field-definitions", sfafHandler.GetFieldDefinitions)
		api.POST("/sfaf/import", sfafHandler.ImportSFAF)
		api.GET("/sfaf/export", sfafHandler.ExportAllSFAF)
		api.GET("/sfaf/export/:marker_id", sfafHandler.ExportSingleSFAF)

		// FIELD 530 POLYGON ROUTES
		api.GET("/sfaf/field530/polygons", sfafHandler.GetAllField530Polygons)
		api.GET("/sfaf/field530/marker/:marker_id", sfafHandler.GetField530PolygonByMarker)
		api.POST("/sfaf/field530/validate", sfafHandler.ValidateField530Format)

		// GEOMETRY ROUTES
		api.POST("/geometry/circle", geometryHandler.CreateCircle)
		api.PUT("/geometry/circle/:id", geometryHandler.UpdateCircle)
		api.POST("/geometry/polygon", geometryHandler.CreatePolygon)
		api.PUT("/geometry/polygon/:id", geometryHandler.UpdatePolygon)
		api.POST("/geometry/rectangle", geometryHandler.CreateRectangle)
		api.PUT("/geometry/rectangle/:id", geometryHandler.UpdateRectangle)
		api.GET("/geometry", geometryHandler.GetAllGeometries)
		api.DELETE("/geometry/:id", geometryHandler.DeleteGeometry)

		// FREQUENCY MANAGEMENT ROUTES
		frequency := api.Group("/frequency")
		{
			// Unit routes
			frequency.GET("/units", frequencyHandler.GetUserUnits)
			frequency.POST("/units", frequencyHandler.CreateUnit)
			frequency.PUT("/units/:id", frequencyHandler.UpdateUnit)
			frequency.DELETE("/units/:id", frequencyHandler.DeleteUnit)

			// Frequency assignment routes
			frequency.GET("/assignments", frequencyHandler.GetUserFrequencyAssignments)
			frequency.GET("/assignments/expiring", frequencyHandler.GetExpiringFrequencies)
			frequency.POST("/assignments", frequencyHandler.CreateFrequencyAssignment)
			frequency.GET("/assignments/conflicts", frequencyHandler.CheckFrequencyConflicts)

			// Frequency request routes
			frequency.GET("/requests", frequencyHandler.GetUserRequests)
			frequency.GET("/requests/pending", frequencyHandler.GetPendingRequests)
			frequency.POST("/requests", frequencyHandler.SubmitFrequencyRequest)
			frequency.PUT("/requests/:id/review", frequencyHandler.ReviewFrequencyRequest)
			frequency.POST("/requests/:id/approve", frequencyHandler.ApproveFrequencyRequest)
		}
	}

	serverAddr := fmt.Sprintf(":%s", appConfig.Server.Port)

	logger.Info("🚀 SFAF Plotter server starting",
		zap.String("address", serverAddr),
		zap.String("mode", appConfig.Server.GinMode),
	)
	logger.Info("📊 Database connection established",
		zap.String("host", appConfig.Database.Host),
		zap.String("database", appConfig.Database.DBName),
	)
	logger.Info("🗺️ MCEB Publication 7 compliance enabled")

	if err := r.Run(serverAddr); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
