import java.util.HashMap;
import java.util.Map;

enum Destination {
    PARIS("Paris", 250),
    TOKYO("Tokyo", 450),
    CAIRO("Cairo", 300);

    private final String name;
    private final int cost;

    Destination(String name, int cost) {
        this.name = name;
        this.cost = cost;
    }

    public int getCost() {
        return cost;
    }

    public static Destination fromString(String input) {
        for (Destination d : Destination.values()) {
            if (d.name.equalsIgnoreCase(input)) {
                return d;
            }
        }
        throw new IllegalArgumentException("Invalid destination: " + input);
    }
}

enum TripType {
    ONE_WAY("one-way", 1),
    ROUND("round", 2);

    private final String name;
    private final int multiplier;

    TripType(String name, int multiplier) {
        this.name = name;
        this.multiplier = multiplier;
    }

    public int getMultiplier() {
        return multiplier;
    }

    public static TripType fromString(String input) {
        for (TripType t : TripType.values()) {
            if (t.name.equalsIgnoreCase(input)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Invalid trip type: " + input);
    }
}

class FlightCostCalculator {
    private final int numberOfTravelers;
    private final Destination destination;
    private final TripType tripType;

    public FlightCostCalculator(int numberOfTravelers, Destination destination, TripType tripType) {
        if (numberOfTravelers <= 0) {
            throw new IllegalArgumentException("Number of travelers must be greater than zero.");
        }
        this.numberOfTravelers = numberOfTravelers;
        this.destination = destination;
        this.tripType = tripType;
    }

    public int calculateTotalCost() {
        return numberOfTravelers * destination.getCost() * tripType.getMultiplier();
    }
}

public class Main {
    public static void main(String[] args) {
        handle(args[0]);
    }

    private static void handle(String input) {
        String[] inputList = input.trim().split(" ");
        if (inputList.length != 3) {
            System.out.println("Invalid input. Expected format: <NoOfTravelers> <Destination> <TripType>");
            return;
        }

        try {
            int travelers = Integer.parseInt(inputList[0]);
            Destination destination = Destination.fromString(inputList[1]);
            TripType tripType = TripType.fromString(inputList[2]);

            FlightCostCalculator calculator = new FlightCostCalculator(travelers, destination, tripType);
            int totalCost = calculator.calculateTotalCost();

            System.out.println("Total Flight Cost: " + totalCost);
        } catch (NumberFormatException e) {
            System.out.println("Invalid number of travelers: " + inputList[0]);
        } catch (IllegalArgumentException e) {
            System.out.println(e.getMessage());
        }
    }
}
