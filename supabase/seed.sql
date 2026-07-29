-- COFX demonstration data for Wannerpart by COFX
-- Safe to run repeatedly: every insert is keyed and idempotent.

-- Customers
insert into customers (id, full_name, phone, email, company, customer_type, address, city, birthday, source, loyalty_tier, loyalty_points, lifetime_value, total_orders, last_purchase_at, notes) values
('11111111-1111-4111-8111-000000000001', 'Adeola Bankole', '+2348030000001', 'adeola.bankole@example.com', null, 'individual', '14 Adeniyi Jones Avenue, Ikeja', 'Lagos', '1988-07-29', 'walk_in', 'silver', 640, 640000, 4, now() - interval '38 days', 'Drives a Corolla, prefers Bosch pads.'),
('11111111-1111-4111-8111-000000000002', 'Chinedu Okeke', '+2348030000002', 'chinedu.okeke@example.com', 'Okeke Haulage Limited', 'fleet', '7 Kirikiri Industrial Road, Apapa', 'Lagos', '1979-03-14', 'referral', 'gold', 2450, 2450000, 11, now() - interval '9 days', 'Fleet of nine Hilux units. Buys filters in bulk each quarter.'),
('11111111-1111-4111-8111-000000000003', 'Fatima Yusuf', '+2348030000003', 'fatima.yusuf@example.com', null, 'individual', '22 Gwarinpa Estate', 'Abuja', '1992-11-02', 'assistant', 'bronze', 120, 120000, 2, now() - interval '210 days', 'Reached us through the online assistant.'),
('11111111-1111-4111-8111-000000000004', 'Emeka Nwosu', '+2348030000004', 'emeka.nwosu@example.com', 'Swift Auto Workshop', 'workshop', '4 Oshodi Expressway Service Lane', 'Lagos', '1985-01-21', 'call', 'silver', 890, 890000, 7, now() - interval '21 days', 'Independent workshop, resells to walk in customers.'),
('11111111-1111-4111-8111-000000000005', 'Ngozi Balogun', '+2348030000005', 'ngozi.balogun@example.com', null, 'individual', '9 Admiralty Way, Lekki Phase 1', 'Lagos', '1990-06-08', 'campaign', 'bronze', 210, 210000, 3, now() - interval '75 days', 'Battery fitted last year, due for a check.'),
('11111111-1111-4111-8111-000000000006', 'Tunde Alabi', '+2348030000006', 'tunde.alabi@example.com', 'Alabi Logistics', 'fleet', '31 Ikorodu Road, Maryland', 'Lagos', '1983-09-30', 'walk_in', 'platinum', 5200, 5200000, 19, now() - interval '4 days', 'Largest fleet account. Candidate for customer of the year.'),
('11111111-1111-4111-8111-000000000007', 'Blessing Eze', '+2348030000007', 'blessing.eze@example.com', null, 'individual', '18 Aba Road', 'Port Harcourt', '1995-04-17', 'whatsapp', 'bronze', 60, 60000, 1, now() - interval '300 days', 'Single purchase, good win back candidate.'),
('11111111-1111-4111-8111-000000000008', 'Ibrahim Sani', '+2348030000008', 'ibrahim.sani@example.com', 'Sani Motors', 'dealer', '2 Zaria Road', 'Kano', '1981-12-05', 'referral', 'gold', 2100, 2100000, 9, now() - interval '17 days', 'Dealer account in the north, buys lubricants in volume.')
on conflict (id) do nothing;

-- Vehicles
insert into vehicles (id, customer_id, make, model, year, plate_number, engine, mileage_km, battery_installed_on, battery_warranty_months, last_service_at, next_service_due) values
('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Toyota', 'Corolla', 2015, 'LAG-431-KJA', '1.8 petrol', 128000, current_date - interval '17 months', 18, current_date - interval '5 months', current_date + interval '9 days'),
('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000002', 'Toyota', 'Hilux', 2019, 'APP-882-XA', '2.4 diesel', 210000, current_date - interval '10 months', 18, current_date - interval '2 months', current_date + interval '35 days'),
('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000002', 'Toyota', 'Hilux', 2020, 'APP-883-XA', '2.4 diesel', 176000, current_date - interval '8 months', 18, current_date - interval '1 month', current_date + interval '60 days'),
('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-000000000003', 'Honda', 'Accord', 2013, 'ABJ-119-AA', '2.4 petrol', 165000, current_date - interval '20 months', 18, current_date - interval '11 months', current_date + interval '4 days'),
('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-000000000004', 'Nissan', 'Almera', 2017, 'LAG-777-MU', '1.5 petrol', 98000, current_date - interval '6 months', 18, current_date - interval '3 months', current_date + interval '90 days'),
('22222222-2222-4222-8222-000000000006', '11111111-1111-4111-8111-000000000005', 'Kia', 'Rio', 2018, 'LAG-204-EPE', '1.4 petrol', 74000, current_date - interval '17 months', 18, current_date - interval '7 months', current_date + interval '12 days'),
('22222222-2222-4222-8222-000000000007', '11111111-1111-4111-8111-000000000006', 'Ford', 'Ranger', 2021, 'LAG-990-IKJ', '2.2 diesel', 132000, current_date - interval '4 months', 18, current_date - interval '1 month', current_date + interval '75 days'),
('22222222-2222-4222-8222-000000000008', '11111111-1111-4111-8111-000000000006', 'Toyota', 'Camry', 2016, 'LAG-991-IKJ', '2.5 petrol', 188000, current_date - interval '19 months', 18, current_date - interval '9 months', current_date + interval '6 days'),
('22222222-2222-4222-8222-000000000009', '11111111-1111-4111-8111-000000000007', 'Hyundai', 'Elantra', 2014, 'PHC-556-RV', '1.6 petrol', 152000, current_date - interval '30 months', 18, current_date - interval '18 months', current_date - interval '30 days'),
('22222222-2222-4222-8222-000000000010', '11111111-1111-4111-8111-000000000008', 'Mitsubishi', 'L200', 2018, 'KAN-345-KN', '2.4 diesel', 143000, current_date - interval '12 months', 18, current_date - interval '4 months', current_date + interval '45 days')
on conflict (id) do nothing;

-- Aftermarket parts catalogue
insert into parts (id, sku, name, category, brand, description, unit_price, cost_price, stock_qty, reorder_level, warranty_months) values
('33333333-3333-4333-8333-000000000001', 'WP-BRK-1001', 'Front brake pad set, ceramic', 'brakes', 'Bosch', 'Low dust ceramic compound, fits several mid size saloons and crossovers.', 48500, 33000, 42, 10, 12),
('33333333-3333-4333-8333-000000000002', 'WP-BRK-1002', 'Rear brake pad set, semi metallic', 'brakes', 'Valeo', 'Semi metallic rear pads suited to heavier duty use.', 39500, 27000, 28, 8, 12),
('33333333-3333-4333-8333-000000000003', 'WP-BRK-1010', 'Front brake disc, vented, 296mm', 'brakes', 'Brembo', 'Vented disc for saloons and pickups sharing the 296mm hub pattern.', 62000, 44000, 16, 6, 12),
('33333333-3333-4333-8333-000000000004', 'WP-FLT-2001', 'Engine oil filter, spin on', 'filters', 'Mann Filter', 'Spin on filter covering a wide range of petrol and diesel engines.', 7800, 4900, 160, 40, 6),
('33333333-3333-4333-8333-000000000005', 'WP-FLT-2002', 'Air filter element', 'filters', 'Mann Filter', 'Panel air filter for common saloons and pickups.', 11500, 7200, 95, 25, 6),
('33333333-3333-4333-8333-000000000006', 'WP-FLT-2003', 'Cabin pollen filter', 'filters', 'Bosch', 'Activated carbon cabin filter, reduces dust in heavy traffic.', 9800, 6100, 88, 20, 6),
('33333333-3333-4333-8333-000000000007', 'WP-FLT-2004', 'Diesel fuel filter', 'filters', 'Denso', 'Water separating diesel filter for light commercial engines.', 16400, 11000, 54, 15, 6),
('33333333-3333-4333-8333-000000000008', 'WP-BAT-3001', 'Battery 12V 70Ah maintenance free', 'battery', 'Exide', 'Sealed calcium battery, eighteen month warranty.', 96000, 71000, 24, 8, 18),
('33333333-3333-4333-8333-000000000009', 'WP-BAT-3002', 'Battery 12V 100Ah heavy duty', 'battery', 'Exide', 'Heavy duty battery for pickups, buses and light trucks.', 148000, 112000, 12, 5, 18),
('33333333-3333-4333-8333-000000000010', 'WP-SUS-4001', 'Front shock absorber, gas', 'suspension', 'Monroe', 'Gas pressurised front damper tuned for rough road use.', 54000, 38000, 30, 10, 12),
('33333333-3333-4333-8333-000000000011', 'WP-SUS-4002', 'Rear shock absorber, gas', 'suspension', 'Monroe', 'Rear damper matched to the front unit for balanced handling.', 49500, 34500, 26, 10, 12),
('33333333-3333-4333-8333-000000000012', 'WP-IGN-5001', 'Iridium spark plug', 'ignition', 'NGK', 'Long life iridium plug, sold per unit.', 8900, 5600, 240, 60, 12),
('33333333-3333-4333-8333-000000000013', 'WP-LUB-6001', 'Engine oil 5W-30 synthetic, 5 litres', 'lubricants', 'Total', 'Fully synthetic oil for modern petrol and diesel engines.', 42000, 31000, 120, 30, 0),
('33333333-3333-4333-8333-000000000014', 'WP-LUB-6002', 'Engine oil 15W-40 mineral, 5 litres', 'lubricants', 'Mobil', 'Mineral oil for older and high mileage engines.', 31000, 22500, 140, 35, 0),
('33333333-3333-4333-8333-000000000015', 'WP-ELE-7001', 'Alternator 90A remanufactured', 'electrical', 'Valeo', 'Remanufactured alternator, tested output, twelve month warranty.', 178000, 132000, 8, 3, 12),
('33333333-3333-4333-8333-000000000016', 'WP-WPR-8001', 'Wiper blade pair, 24 and 18 inch', 'body', 'Bosch', 'Flat beam wiper pair covering most saloons.', 18500, 12000, 70, 20, 6)
on conflict (id) do nothing;

-- Fitment matrix, the multi brand promise of the aftermarket range
insert into part_fitments (part_id, make, model, year_from, year_to, note) values
('33333333-3333-4333-8333-000000000001', 'Toyota', 'Corolla', 2009, 2019, null),
('33333333-3333-4333-8333-000000000001', 'Toyota', 'Camry', 2007, 2017, null),
('33333333-3333-4333-8333-000000000001', 'Honda', 'Accord', 2008, 2017, null),
('33333333-3333-4333-8333-000000000001', 'Nissan', 'Almera', 2013, 2020, null),
('33333333-3333-4333-8333-000000000001', 'Hyundai', 'Elantra', 2011, 2018, null),
('33333333-3333-4333-8333-000000000002', 'Toyota', 'Hilux', 2015, 2023, null),
('33333333-3333-4333-8333-000000000002', 'Ford', 'Ranger', 2016, 2023, null),
('33333333-3333-4333-8333-000000000002', 'Mitsubishi', 'L200', 2015, 2022, null),
('33333333-3333-4333-8333-000000000003', 'Toyota', 'Hilux', 2015, 2023, 'Front axle only'),
('33333333-3333-4333-8333-000000000003', 'Ford', 'Ranger', 2016, 2023, 'Front axle only'),
('33333333-3333-4333-8333-000000000004', 'Toyota', 'Corolla', 2007, 2022, null),
('33333333-3333-4333-8333-000000000004', 'Toyota', 'Hilux', 2010, 2023, null),
('33333333-3333-4333-8333-000000000004', 'Honda', 'Accord', 2008, 2020, null),
('33333333-3333-4333-8333-000000000004', 'Kia', 'Rio', 2012, 2021, null),
('33333333-3333-4333-8333-000000000004', 'Nissan', 'Almera', 2012, 2021, null),
('33333333-3333-4333-8333-000000000005', 'Toyota', 'Corolla', 2009, 2019, null),
('33333333-3333-4333-8333-000000000005', 'Toyota', 'Camry', 2012, 2020, null),
('33333333-3333-4333-8333-000000000005', 'Ford', 'Ranger', 2016, 2023, null),
('33333333-3333-4333-8333-000000000006', 'Toyota', 'Corolla', 2014, 2022, null),
('33333333-3333-4333-8333-000000000006', 'Kia', 'Rio', 2015, 2022, null),
('33333333-3333-4333-8333-000000000007', 'Toyota', 'Hilux', 2015, 2023, null),
('33333333-3333-4333-8333-000000000007', 'Mitsubishi', 'L200', 2015, 2022, null),
('33333333-3333-4333-8333-000000000008', 'Toyota', 'Corolla', 2007, 2022, null),
('33333333-3333-4333-8333-000000000008', 'Honda', 'Accord', 2008, 2020, null),
('33333333-3333-4333-8333-000000000008', 'Kia', 'Rio', 2012, 2022, null),
('33333333-3333-4333-8333-000000000008', 'Hyundai', 'Elantra', 2011, 2020, null),
('33333333-3333-4333-8333-000000000009', 'Toyota', 'Hilux', 2010, 2023, null),
('33333333-3333-4333-8333-000000000009', 'Ford', 'Ranger', 2016, 2023, null),
('33333333-3333-4333-8333-000000000009', 'Mitsubishi', 'L200', 2015, 2022, null),
('33333333-3333-4333-8333-000000000010', 'Toyota', 'Corolla', 2009, 2019, null),
('33333333-3333-4333-8333-000000000010', 'Toyota', 'Hilux', 2015, 2023, null),
('33333333-3333-4333-8333-000000000012', 'Toyota', 'Corolla', 2009, 2022, 'Four required per engine'),
('33333333-3333-4333-8333-000000000012', 'Honda', 'Accord', 2008, 2020, 'Four required per engine'),
('33333333-3333-4333-8333-000000000013', 'Toyota', 'Corolla', 2009, 2023, null),
('33333333-3333-4333-8333-000000000013', 'Honda', 'Accord', 2008, 2022, null),
('33333333-3333-4333-8333-000000000014', 'Toyota', 'Hilux', 2005, 2018, null),
('33333333-3333-4333-8333-000000000015', 'Toyota', 'Corolla', 2009, 2019, null),
('33333333-3333-4333-8333-000000000016', 'Toyota', 'Corolla', 2009, 2022, null),
('33333333-3333-4333-8333-000000000016', 'Toyota', 'Camry', 2012, 2022, null)
on conflict do nothing;

-- Knowledge base used by the assistant
insert into kb_articles (id, title, body, tags) values
('44444444-4444-4444-8444-000000000001', 'Opening hours and location',
 'Wannerpart by COFX opens Monday to Friday from 8am to 6pm and Saturday from 9am to 4pm. We are closed on Sunday and public holidays. The main counter and workshop are on the Oshodi Apapa Expressway service lane in Lagos, with a branch counter in Abuja.',
 array['hours', 'location']),
('44444444-4444-4444-8444-000000000002', 'How payment and release works',
 'Payments are made by transfer to the COFX Mobility head office account. Every order carries a payment reference code. Put that code in the transfer narration so the system can match your payment automatically and release your parts without waiting for a manual finance check. Cash and card payments at the counter are released immediately.',
 array['payment', 'transfer', 'release']),
('44444444-4444-4444-8444-000000000003', 'Fitment guarantee',
 'Wannerpart supplies independent aftermarket parts that fit several vehicle brands. Every part we quote is checked against our fitment matrix using your make, model and year. If a part does not fit the vehicle it was quoted for, return it unused within fourteen days for a replacement or full refund.',
 array['fitment', 'returns', 'warranty']),
('44444444-4444-4444-8444-000000000004', 'Warranty terms',
 'Brake, suspension, electrical and filtration parts carry a warranty of six to twelve months depending on the item. Batteries carry an eighteen month warranty. Warranty covers manufacturing defects, not wear from misuse or accident damage. Keep your receipt or quote your order number when making a claim.',
 array['warranty', 'battery']),
('44444444-4444-4444-8444-000000000005', 'Delivery and dispatch',
 'Orders confirmed before 2pm are dispatched the same working day within Lagos. Deliveries to Abuja, Port Harcourt and Kano go by courier and usually arrive within two to three working days. Fleet customers can arrange scheduled weekly delivery.',
 array['delivery', 'dispatch']),
('44444444-4444-4444-8444-000000000006', 'Fleet and workshop accounts',
 'Fleet operators, workshops and dealers can open a trade account with volume pricing on filters, lubricants and brake components. Trade accounts receive a dedicated sales representative, quarterly stock planning and priority allocation on fast moving lines.',
 array['fleet', 'trade', 'workshop'])
on conflict (id) do nothing;

-- Open sales tickets, deliberately left unassigned so the setup script can distribute them
insert into sales_tickets (id, ticket_no, customer_id, channel, subject, description, intent, status, priority, value_estimate, created_at, last_update_at) values
('55555555-5555-4555-8555-000000000001', 'WP-2026-9001', '11111111-1111-4111-8111-000000000001', 'assistant', 'Front brake pads for Toyota Corolla 2015', 'Customer reports squealing under braking. Needs front pads and possibly discs.', 'parts_enquiry', 'open', 'normal', 110500, now() - interval '3 days', now() - interval '3 days'),
('55555555-5555-4555-8555-000000000002', 'WP-2026-9002', '11111111-1111-4111-8111-000000000002', 'call', 'Quarterly filter order for Hilux fleet', 'Nine vehicles, oil and air filters plus diesel filters for the quarter.', 'fleet_quote', 'wip', 'high', 486000, now() - interval '6 days', now() - interval '2 days'),
('55555555-5555-4555-8555-000000000003', 'WP-2026-9003', '11111111-1111-4111-8111-000000000005', 'whatsapp', 'Battery replacement enquiry for Kia Rio', 'Battery struggling to start in the morning. Wants a price and fitting slot.', 'parts_enquiry', 'open', 'normal', 96000, now() - interval '5 days', now() - interval '5 days'),
('55555555-5555-4555-8555-000000000004', 'WP-2026-9004', '11111111-1111-4111-8111-000000000004', 'walk_in', 'Alternator for Nissan Almera 2017', 'Workshop customer needs a remanufactured alternator, urgent for a job on the ramp.', 'parts_enquiry', 'awaiting_payment', 'urgent', 178000, now() - interval '1 day', now() - interval '5 hours'),
('55555555-5555-4555-8555-000000000005', 'WP-2026-9005', '11111111-1111-4111-8111-000000000006', 'assistant', 'Service booking for Ford Ranger', 'Fleet operator wants a service slot and a shock absorber inspection.', 'appointment', 'open', 'high', 210000, now() - interval '2 days', now() - interval '2 days'),
('55555555-5555-4555-8555-000000000006', 'WP-2026-9006', '11111111-1111-4111-8111-000000000008', 'email', 'Bulk lubricant order for dealer account', 'Forty units of 5W-30 synthetic and twenty units of 15W-40 for the Kano branch.', 'fleet_quote', 'closed', 'normal', 2300000, now() - interval '18 days', now() - interval '12 days'),
('55555555-5555-4555-8555-000000000007', 'WP-2026-9007', '11111111-1111-4111-8111-000000000003', 'assistant', 'Cabin filter and wiper blades for Honda Accord', 'Customer asked the assistant for a price on cabin filter and wipers.', 'parts_enquiry', 'open', 'low', 28300, now() - interval '9 days', now() - interval '9 days')
on conflict (id) do nothing;

update sales_tickets set outcome = 'won', closed_at = now() - interval '12 days' where id = '55555555-5555-4555-8555-000000000006' and outcome is null;

-- Orders and the payment references customers must quote on transfer
insert into orders (id, order_no, customer_id, ticket_id, status, subtotal, discount, total, payment_reference, created_at) values
('66666666-6666-4666-8666-000000000001', 'ORD-2026-9001', '11111111-1111-4111-8111-000000000004', '55555555-5555-4555-8555-000000000004', 'pending_payment', 178000, 0, 178000, 'WPA31F09', now() - interval '6 hours'),
('66666666-6666-4666-8666-000000000002', 'ORD-2026-9002', '11111111-1111-4111-8111-000000000002', '55555555-5555-4555-8555-000000000002', 'pending_payment', 486000, 26000, 460000, 'WPB77C21', now() - interval '2 days'),
('66666666-6666-4666-8666-000000000003', 'ORD-2026-9003', '11111111-1111-4111-8111-000000000001', '55555555-5555-4555-8555-000000000001', 'pending_payment', 110500, 0, 110500, 'WPC04D55', now() - interval '3 hours')
on conflict (id) do nothing;

insert into order_items (order_id, part_id, description, qty, unit_price, line_total) values
('66666666-6666-4666-8666-000000000001', '33333333-3333-4333-8333-000000000015', 'Alternator 90A remanufactured', 1, 178000, 178000),
('66666666-6666-4666-8666-000000000002', '33333333-3333-4333-8333-000000000004', 'Engine oil filter, spin on', 18, 7800, 140400),
('66666666-6666-4666-8666-000000000002', '33333333-3333-4333-8333-000000000005', 'Air filter element', 9, 11500, 103500),
('66666666-6666-4666-8666-000000000002', '33333333-3333-4333-8333-000000000007', 'Diesel fuel filter', 9, 16400, 147600),
('66666666-6666-4666-8666-000000000003', '33333333-3333-4333-8333-000000000001', 'Front brake pad set, ceramic', 1, 48500, 48500),
('66666666-6666-4666-8666-000000000003', '33333333-3333-4333-8333-000000000003', 'Front brake disc, vented, 296mm', 1, 62000, 62000)
on conflict do nothing;

insert into payments (id, order_id, customer_id, amount, method, declared_ref, status, created_at) values
('77777777-7777-4777-8777-000000000001', '66666666-6666-4666-8666-000000000001', '11111111-1111-4111-8111-000000000004', 178000, 'transfer', 'WPA31F09', 'awaiting', now() - interval '5 hours'),
('77777777-7777-4777-8777-000000000002', '66666666-6666-4666-8666-000000000002', '11111111-1111-4111-8111-000000000002', 460000, 'transfer', 'WPB77C21', 'awaiting', now() - interval '1 day'),
('77777777-7777-4777-8777-000000000003', '66666666-6666-4666-8666-000000000003', '11111111-1111-4111-8111-000000000001', 110500, 'transfer', 'WPC04D55', 'awaiting', now() - interval '2 hours')
on conflict (id) do nothing;

-- Unmatched bank alerts waiting for the verification engine to reconcile
insert into bank_alerts (id, source, raw_subject, raw_body, bank, account_last4, amount, transaction_ref, sender_name, narration, value_date, parse_confidence, parse_method, status) values
('88888888-8888-4888-8888-000000000001', 'email', 'Credit Alert', 'Dear Customer, your account 1234 has been credited with NGN178,000.00 on 08-JUL-2026. Description: TRF FROM SWIFT AUTO WORKSHOP WPA31F09. Ref: FT26071900123456. Available balance NGN 44,120,904.11', 'First Bank', '1234', 178000, 'FT26071900123456', 'SWIFT AUTO WORKSHOP', 'TRF FROM SWIFT AUTO WORKSHOP WPA31F09', now() - interval '4 hours', 96, 'regex', 'unmatched'),
('88888888-8888-4888-8888-000000000002', 'email', 'Credit Alert', 'Dear Customer, your account 1234 has been credited with NGN460,000.00 on 07-JUL-2026. Description: OKEKE HAULAGE LTD WPB77C21 PARTS. Ref: FT26071800987654. Available balance NGN 43,942,904.11', 'First Bank', '1234', 460000, 'FT26071800987654', 'OKEKE HAULAGE LTD', 'OKEKE HAULAGE LTD WPB77C21 PARTS', now() - interval '22 hours', 96, 'regex', 'unmatched'),
('88888888-8888-4888-8888-000000000003', 'email', 'Credit Alert', 'Dear Customer, your account 1234 has been credited with NGN110,500.00 on 08-JUL-2026. Description: A BANKOLE TRANSFER. Ref: FT26071900654321. Available balance NGN 44,053,404.11', 'First Bank', '1234', 110500, 'FT26071900654321', 'A BANKOLE', 'A BANKOLE TRANSFER', now() - interval '90 minutes', 78, 'regex', 'unmatched'),
('88888888-8888-4888-8888-000000000004', 'email', 'Credit Alert', 'Dear Customer, your account 1234 has been credited with NGN25,000.00 on 08-JUL-2026. Description: SCHOOL FEES REFUND. Ref: FT26071900111222. Available balance NGN 44,078,404.11', 'First Bank', '1234', 25000, 'FT26071900111222', 'UNKNOWN SENDER', 'SCHOOL FEES REFUND', now() - interval '30 minutes', 71, 'regex', 'unmatched')
on conflict (id) do nothing;

-- Upcoming workshop appointments
insert into appointments (customer_id, vehicle_id, ticket_id, service_type, scheduled_for, duration_minutes, bay, estimated_wait_minutes, status, notes) values
('11111111-1111-4111-8111-000000000006', '22222222-2222-4222-8222-000000000007', '55555555-5555-4555-8555-000000000005', 'general_service', now() + interval '2 days', 90, 'Bay 2', 25, 'confirmed', 'Include shock absorber inspection.'),
('11111111-1111-4111-8111-000000000005', '22222222-2222-4222-8222-000000000006', '55555555-5555-4555-8555-000000000003', 'battery_check', now() + interval '1 day', 30, 'Bay 1', 15, 'scheduled', 'Free battery test then fit if required.'),
('11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '55555555-5555-4555-8555-000000000001', 'brake_service', now() + interval '3 days', 60, 'Bay 3', 20, 'scheduled', 'Front pads and discs.')
on conflict do nothing;
