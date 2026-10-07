-- SAMPLE DATA ONLY. These are fictional businesses placed around Texarkana for
-- development and demos. Replace with real local vendors (with their permission)
-- before the final presentation.

INSERT INTO businesses (name, description, story, cuisine, vendor_type, price_level, address, is_licensed, location) VALUES
('Sample: Himalayan Momo House', 'Hand-folded momos and thali sets.',
 'Recipes from a family kitchen in Pokhara, Nepal.', 'nepali', 'restaurant', 2,
 '100 Sample St, Texarkana, TX', TRUE,
 ST_GeomFromText('POINT(-94.0477 33.4251)', 4326, 'axis-order=long-lat')),
('Sample: Abuela''s Birria Truck', 'Birria tacos with consomé, weekends only.',
 'Grandma''s Jalisco recipe, three generations on.', 'mexican', 'food-truck', 1,
 'Parked near 200 Sample Ave, Texarkana, AR', TRUE,
 ST_GeomFromText('POINT(-94.0200 33.4410)', 4326, 'axis-order=long-lat')),
('Sample: Saigon Corner Pho', 'Slow-simmered pho and banh mi.',
 'Family-run since the owners moved from Ho Chi Minh City.', 'vietnamese', 'restaurant', 2,
 '300 Sample Blvd, Texarkana, TX', TRUE,
 ST_GeomFromText('POINT(-94.0900 33.4600)', 4326, 'axis-order=long-lat')),
('Sample: Big Mama''s Soul Kitchen', 'Smothered pork chops, collards, cornbread.',
 'Sunday-dinner cooking from East Texas.', 'soul-food', 'restaurant', 2,
 '400 Sample Rd, Texarkana, TX', TRUE,
 ST_GeomFromText('POINT(-94.0600 33.4000)', 4326, 'axis-order=long-lat')),
('Sample: Shreveport Cajun Pop-up', 'Crawfish étouffée at the farmers market.',
 'Louisiana family recipes.', 'cajun', 'pop-up', 2,
 'Sample Farmers Market, Shreveport, LA', TRUE,
 ST_GeomFromText('POINT(-93.7502 32.5252)', 4326, 'axis-order=long-lat'));

INSERT INTO dishes (business_id, name, description, price_cents, is_vegetarian) VALUES
(1, 'Chicken Momo', 'Steamed dumplings with tomato achar', 1099, FALSE),
(1, 'Veg Momo', 'Cabbage and paneer filling', 999, TRUE),
(1, 'Dal Bhat Thali', 'Lentils, rice, tarkari, achar', 1399, TRUE),
(2, 'Birria Tacos', 'Three tacos with consomé', 1200, FALSE),
(2, 'Quesabirria', 'Cheesy birria taco', 450, FALSE),
(3, 'Pho Tai', 'Rare beef pho', 1250, FALSE),
(3, 'Banh Mi', 'Grilled pork baguette', 899, FALSE),
(4, 'Smothered Pork Chop', 'With two sides', 1499, FALSE),
(4, 'Collard Greens', 'Side', 399, FALSE),
(5, 'Crawfish Etouffee', 'Over rice', 1599, FALSE);

INSERT INTO reviews (business_id, author_name, authenticity, taste, value, comment) VALUES
(1, 'Sample Reviewer', 5, 5, 4, 'Tastes like home.'),
(2, 'Sample Reviewer', 5, 5, 5, 'Get extra consomé.'),
(3, 'Sample Reviewer', 4, 5, 4, NULL);
