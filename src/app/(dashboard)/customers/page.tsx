import { Metadata } from "next";

import PageTitle from "@/components/shared/PageTitle";
import CustomerActions from "./_components/CustomerActions";
import CustomerFilters from "./_components/CustomerFilters";
import AllCustomers from "./_components/customers-table";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  return (
    <section>
      <PageTitle>Customers</PageTitle>

      <CustomerActions />
      <CustomerFilters />
      <AllCustomers />
    </section>
  );
}
